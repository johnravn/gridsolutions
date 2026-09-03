import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  applyOptimisticMarkAllMattersRead,
  applyOptimisticMatterReadState,
  restoreOptimisticMatterReadSnapshot,
} from './optimisticMatterRead'

describe('optimisticMatterRead', () => {
  it('marks selected matters read and decrements unread count', () => {
    const qc = new QueryClient()
    qc.setQueryData(
      ['matters', 'index', 'all', 'user-1'],
      [
        { id: 'a', is_unread: true },
        { id: 'b', is_unread: true },
        { id: 'c', is_unread: false },
      ],
    )
    qc.setQueryData(['matters', 'unread-count', 'all', 'user-1'], 2)
    qc.setQueryData(['matters', 'detail', 'a'], {
      id: 'a',
      is_unread: true,
    })

    applyOptimisticMatterReadState(qc, {
      matterIds: ['a'],
      isUnread: false,
    })

    expect(qc.getQueryData(['matters', 'index', 'all', 'user-1'])).toEqual([
      { id: 'a', is_unread: false },
      { id: 'b', is_unread: true },
      { id: 'c', is_unread: false },
    ])
    expect(qc.getQueryData(['matters', 'detail', 'a'])).toEqual({
      id: 'a',
      is_unread: false,
    })
    expect(qc.getQueryData(['matters', 'unread-count', 'all', 'user-1'])).toBe(
      1,
    )
  })

  it('restores snapshot on rollback', () => {
    const qc = new QueryClient()
    const key = ['matters', 'index', 'all', 'user-1']
    const original = [{ id: 'a', is_unread: true }]
    qc.setQueryData(key, original)
    qc.setQueryData(['matters', 'unread-count', 'all', 'user-1'], 1)

    const snapshot = applyOptimisticMatterReadState(qc, {
      matterIds: ['a'],
      isUnread: false,
    })
    restoreOptimisticMatterReadSnapshot(qc, snapshot)

    expect(qc.getQueryData(key)).toEqual(original)
    expect(qc.getQueryData(['matters', 'unread-count', 'all', 'user-1'])).toBe(
      1,
    )
  })

  it('mark all read clears unread flags and counts', () => {
    const qc = new QueryClient()
    qc.setQueryData(
      ['matters', 'index', 'all', 'user-1'],
      [
        { id: 'a', is_unread: true },
        { id: 'b', is_unread: true },
      ],
    )
    qc.setQueryData(['matters', 'unread-count', 'all', 'user-1'], 5)

    applyOptimisticMarkAllMattersRead(qc)

    expect(qc.getQueryData(['matters', 'index', 'all', 'user-1'])).toEqual([
      { id: 'a', is_unread: false },
      { id: 'b', is_unread: false },
    ])
    expect(qc.getQueryData(['matters', 'unread-count', 'all', 'user-1'])).toBe(
      0,
    )
  })
})
