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
      ${ghRepo.forkedFrom && computeGHRepositoryHash(ghRepo.forkedFrom)}`
}

export function isFork(ghRepository: IGHRepository) {
  return ghRepository.forkedFrom != null
}
