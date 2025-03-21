import { GitHub } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { GitHubClient } from './github_client_interface';
import { default as Octokit } from '@octokit/rest';

export class GitHubClientWrapper implements GitHubClient{

  restClient: GitHub;
  owner: string;
  repo: string;

  constructor(public context: Context, githubToken: string){
    this.restClient = new GitHub(githubToken);
    this.owner = context.repo.owner;
    this.repo = context.repo.repo;
  };
  
  get_current_pull_request_number(): number {
    if (!this.context.payload.issue || !this.context.payload.issue.pull_request){
      throw new Error('Issue is not a pull request! No pull request found in context');
    }
    
    return this.context.payload.issue.number;
  };

  async comment_on_pull_request_async(pr_number: number, comment: string): Promise<void> {
    await this.restClient.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: pr_number,
      body: comment
    });
  };
  
  async fast_forward_target_to_source_async(pr_number: number): Promise<void> {
    const pullRequestData =  await this.get_pull_request(pr_number);
    
    await this.restClient.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${pullRequestData.base.ref}`,
      sha: pullRequestData.head.sha,
      force: false
    });

  };

  async close_pull_request_async(pr_number: number): Promise<void> {
    await this.restClient.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: pr_number,
      state: "closed"
    });
  };

  async get_pull_request_source_head_async(pr_number: number): Promise<string> {
    const pullRequestData =  await this.get_pull_request(pr_number);
    return pullRequestData.head.ref;
  }

  async get_pull_request_target_base_async(pr_number: number): Promise<string> {
    const pullRequestData =  await this.get_pull_request(pr_number);
    return pullRequestData.base.ref;
  }

  async get_pull_request(pr_number: number): Promise<Octokit.PullsGetResponse> {
    const getPrResponse = await this.restClient.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: pr_number
    });

    return getPrResponse.data;
  };

  async set_pull_request_status(pr_number: number, new_status: "error" | "failure" | "pending" | "success" , status_name: string, description?: string): Promise<void> {
    const pullRequestData =  await this.get_pull_request(pr_number);

    const statusResponse = await this.restClient.repos.createStatus({
      owner: this.owner,
      repo: this.repo,
      sha: pullRequestData.head.sha,
      state: new_status,
      context: status_name,
      description
    });
  }

  async compate_branch_head(branch_one: string, branch_two: string): Promise<boolean> {
    const branchOneData = await this.restClient.repos.getBranch({
      owner: this.owner,
      repo: this.repo,
      branch: branch_one
    });

    const branchTwoData = await this.restClient.repos.getBranch({
      owner: this.owner,
      repo: this.repo,
      branch: branch_two
    });

    return branchOneData.data.commit.sha === branchTwoData.data.commit.sha;
  }

};

