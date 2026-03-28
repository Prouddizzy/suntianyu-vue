# Remote Docker Image Build

This repository can build its Docker image without any local Node.js, npm, or Docker installation.

## What is included

- `Dockerfile`: multi-stage build for the Vue frontend
- `nginx/default.conf`: serves the generated static bundle with SPA fallback
- `.github/workflows/docker-image.yml`: GitHub Actions workflow that builds the image on every push, and also supports manual runs
- Docker artifact export: uploads a `.tar.gz` image archive you can download
- Automatic GHCR push on the default branch, or manual GHCR push when requested

## Build inputs

- `image_tag`: optional output tag
- `api_base_url`: baked into the frontend bundle as `VUE_APP_API_BASE_URL`
- `use_mock_api`: baked into the frontend bundle as `VUE_APP_USE_MOCK_API`
- `push_to_ghcr`: also push the built image to GHCR

## Repository variables for automatic push builds

Set these in GitHub repository `Settings -> Secrets and variables -> Actions -> Variables` if you want non-default frontend build parameters during automatic push builds:

- `VUE_APP_API_BASE_URL`
- `VUE_APP_USE_MOCK_API`

## How to build remotely

1. Push this repository to GitHub.
2. GitHub Actions will automatically run `Build frontend image`.
3. Each push uploads a Docker image artifact.
4. Pushes to the default branch also publish the image to GHCR automatically.

## Manual build

If needed, you can still open `Actions` and run `Build frontend image` manually. Manual runs can override:

- `image_tag`
- `api_base_url`
- `use_mock_api`
- `push_to_ghcr`

## How to get the image

- If you keep `push_to_ghcr=false`, download the workflow artifact:
  - `frontend-image-<tag>`
- The artifact contains:
  - `stm32-smart-disinfector-vue-<tag>.tar.gz`

## GHCR tags

- Every successful push publishes:
  - `ghcr.io/<owner>/stm32-smart-disinfector-vue:sha-<short-commit>` on the default branch
  - `ghcr.io/<owner>/stm32-smart-disinfector-vue:<branch-name>` when GHCR push is enabled
- The default branch also updates:
  - `ghcr.io/<owner>/stm32-smart-disinfector-vue:latest`

## How to load the image on a server

```bash
gunzip -c stm32-smart-disinfector-vue-<tag>.tar.gz | docker load
docker run -d --name stm32-frontend -p 8080:80 ghcr.io/<owner>/stm32-smart-disinfector-vue:<tag>
```

If you do not push to GHCR, use the image name shown by `docker load`.
