'use client';

import { GithubAuthProvider, GoogleAuthProvider } from 'firebase/auth';

const githubProvider = new GithubAuthProvider();
githubProvider.addScope('repo');

const googleProvider = new GoogleAuthProvider();

export { githubProvider, googleProvider };
