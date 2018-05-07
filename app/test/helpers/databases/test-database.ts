import { expect } from 'chai'
import * as fs from 'fs'
import { GHDatabase, Collection } from '../../../src/lib/databases/database'

const TestDbPath = '/Users/williamshepherd/Desktop/ghd.test.db'

describe('Database', () => {
  describe('Initialization', () => {
    it('initializes all collections', () => {
      const db = new GHDatabase(TestDbPath)

      const repos = db.getCollection(Collection.Repositories)

      expect(repos).is.not.null
    })
  })

  describe('Adding data', () => {
    it.only('persists the data to disk', async () => {
      const db = new GHDatabase(TestDbPath)
      const repos = db.getCollection(Collection.Repositories)
      repos.insert({
        name: 'test',
        path: '~/ghd.test.db',
      })

      await db.save()

      const exists = fs.existsSync(TestDbPath)

      expect(exists).is.true
    })
  })
})
