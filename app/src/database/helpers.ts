import * as Path from 'path'
import { IUser, IRepository, IGHRepository } from '.'

export function getFullName(repository: IGHRepository | IRepository) {
  let name: string = repository.name

  if (repository.kind === 'repository') {
    name =
      repository.ghRepository == null
        ? repository.name || Path.basename(repository.path)
        : `${repository.ghRepository.owner.login}/${repository.name}`
  } else if (repository.kind === 'gh-repository') {
    name = `${repository.owner.login}/${repository.name}`
  }

  return name
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

export function getEndpoint(repository: IGHRepository): string {
  return repository.owner.endpoint
}

export function createRepositoryModel(
  path: string,
  isMissing: boolean = false,
  ghRepository?: IGHRepository
): IRepository {
  const model: IRepository = {
    kind: 'repository',
    name: (ghRepository && ghRepository.name) || Path.basename(path),
    path,
    isMissing,
    ghRepository,
  }

  return model
}

export function toRepositoryModel(document: IRepository & LokiObj) {
  const result: IRepository = {
    kind: 'repository',
    name: document.name,
    path: document.path,
    isMissing: document.isMissing,
    ghRepository: document.ghRepository,
  }

  return result
}
