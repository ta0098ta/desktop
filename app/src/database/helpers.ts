import { IGHRepository, IUser, IRepository } from '.'

export function fullRepoName(repository: IRepository) {
  if (repository.ghRepository == null) {
    return repository.name
  }

  return `${repository.ghRepository.owner.login}/${repository.name}`
}

export function computeUserHash(user: IUser): string {
  return `${user.login}+${user.endpoint}+${user.avatarUrl}`
}

export function computeGHRepositoryHash(ghRepo: IGHRepository): string {
  return `${ghRepo.defaultBranch}+
      ${ghRepo.isPrivate}+
      ${ghRepo.cloneUrl}+
      ${ghRepo.name}+
      ${ghRepo.htmlUrl}+
      ${computeUserHash(ghRepo.owner)}+
      ${ghRepo.parent && computeGHRepositoryHash(ghRepo.parent)}`
}

export function computeRepositoryHash(repo: IRepository): string {
  return `${repo.name}+
      ${repo.path}+
      ${repo.isMissing}+
      ${repo.ghRepository && computeGHRepositoryHash(repo.ghRepository)}`
}

export function isFork(ghRepository: IGHRepository) {
  return ghRepository.parent != null
}

export function toRepositoryModel(document: IRepository & LokiObj) {
  const result: IRepository = {
    name: document.name,
    path: document.path,
    isMissing: document.isMissing,
    ghRepository: document.ghRepository,
  }

  return result
}
