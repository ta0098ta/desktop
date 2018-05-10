import { CloneOptions } from './git/clone'
import { IRepository } from '../database'

/** The types of actions that can be retried. */
export enum RetryActionType {
  Push = 1,
  Pull,
  Fetch,
  Clone,
}

/** The retriable actions and their associated data. */
export type RetryAction =
  | { type: RetryActionType.Push; repository: IRepository }
  | { type: RetryActionType.Pull; repository: IRepository }
  | { type: RetryActionType.Fetch; repository: IRepository }
  | {
      type: RetryActionType.Clone
      url: string
      path: string
      options: CloneOptions
    }
