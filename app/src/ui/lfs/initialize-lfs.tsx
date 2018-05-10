import * as React from 'react'
import { IRepository } from '../../models/repository'
import { Button } from '../lib/button'
import { ButtonGroup } from '../lib/button-group'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Monospaced } from '../lib/monospaced'
import { PathText } from '../lib/path-text'
import { LinkButton } from '../lib/link-button'

const LFSURL = 'https://git-lfs.github.com/'

/**
 * If we're initializing any more than this number, we won't bother listing them
 * all.
 */
const MaxRepositoriesToList = 10

interface IInitializeLFSProps {
  /** The repositories in which LFS needs to be initialized. */
  readonly repositories: ReadonlyArray<IRepository>

  /**
   * Event triggered when the dialog is dismissed by the user in the
   * ways described in the Dialog component's dismissable prop.
   */
  readonly onDismissed: () => void

  /**
   * Called when the user chooses to initialize LFS in the repositories.
   */
  readonly onInitialize: (repositories: ReadonlyArray<IRepository>) => void
}

export class InitializeLFS extends React.Component<IInitializeLFSProps, {}> {
  public render() {
    return (
      <Dialog
        id="initialize-lfs"
        title="Initialize Git LFS"
        onDismissed={this.props.onDismissed}
        onSubmit={this.onInitialize}
      >
        <DialogContent>{this.renderRepositories()}</DialogContent>

        <DialogFooter>
          <ButtonGroup>
            <Button type="submit">Initialize Git LFS</Button>
            <Button onClick={this.props.onDismissed}>
              {__DARWIN__ ? 'Not Now' : 'Not now'}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </Dialog>
    )
  }

  private onInitialize = () => {
    this.props.onInitialize(this.props.repositories)
  }

  private renderRepositories() {
    if (this.props.repositories.length > MaxRepositoriesToList) {
      return (
        <p>
          {this.props.repositories.length} repositories use{' '}
          <LinkButton uri={LFSURL}>Git LFS</LinkButton>. To contribute to them,
          Git LFS must first be initialized. Would you like to do so now?
        </p>
      )
    } else {
      const plural = this.props.repositories.length !== 1
      const pluralizedRepositories = plural
        ? 'The repositories use'
        : 'This repository uses'
      const pluralizedUse = plural ? 'them' : 'it'
      return (
        <div>
          <p>
            {pluralizedRepositories}{' '}
            <LinkButton uri={LFSURL}>Git LFS</LinkButton>. To contribute to{' '}
            {pluralizedUse}, Git LFS must first be initialized. Would you like
            to do so now?
          </p>
          <ul>
            {this.props.repositories.map(r => (
              <li key={r.id}>
                <Monospaced>
                  <PathText path={r.path} />
                </Monospaced>
              </li>
            ))}
          </ul>
        </div>
      )
    }
  }
}
