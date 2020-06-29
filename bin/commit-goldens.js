#!/usr/bin/env node

const git = require('simple-git/promise')();

const token = process.env.GITHUB_TOKEN || process.env.GITHUB_RELEASE_TOKEN;
const remote = `https://${token}@github.com/${process.env.TRAVIS_REPO_SLUG}`;
const branchName = process.env.TRAVIS_BRANCH;

function commit() {

	git.addConfig('user.name', 'brightspace-bot');
	git.addConfig('user.email', 'brightspacegithubreader@d2l.com');
	git.addConfig('push.default', 'simple');
	git.addConfig('remote.origin.fetch', 'refs/heads/*:refs/remotes/origin/*');

	console.log('Committing and pushing updated goldens...');
	console.group();

	return git.fetch()
		.then(() => {
			return git.checkout(branchName);
		}).then(() => {
			return git.branch();
		}).then((data) => {
			if (data.current !== branchName) {
				process.exit(1);
			}
			console.log(`Checked out branch ${branchName}`);

			return git.add('*');
		}).then(() => {
			console.log('Added goldens. Committing...');
			const commitMessage = `Updating golden with changes made in branch ${branchName}`;
			return git.commit(commitMessage);
		}).then((status) => {
			console.log(status);
			console.log('Committed. Pushing...');
			return git.push(remote, branchName);
		});
}

commit()
	.then(() => {
		console.groupEnd();
		console.log('SUCCESS: Updated goldens were committed and pushed successfully.');
		process.exit(0);
	}).catch((err) => {
		console.error(err);
		console.groupEnd();
		process.exit(1);
	});
