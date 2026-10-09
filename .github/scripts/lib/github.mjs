// GitHub REST·GraphQL 최소 클라이언트 (fetch + Bearer). CI 스크립트 공유용.
// gh CLI 불필요 — Actions의 GITHUB_TOKEN을 그대로 쓴다.

export function makeGithub(token) {
  if (!token) throw new Error("Missing GITHUB_TOKEN.");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "clause-lens-ci",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function request(path, init = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status} ${res.statusText}: ${body}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async function graphql(query, variables) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub GraphQL ${res.status} ${res.statusText}: ${body}`);
    }
    const json = await res.json();
    if (json.errors) throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
    return json.data;
  }

  return { request, graphql };
}
