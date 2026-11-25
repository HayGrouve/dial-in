import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/** Your grinder and Fellow Opus settings, from your Акаунт; undefined while loading. */
export function useEquipment() {
  return useQuery(api.equipment.get)
}

/** Changes the fields given; the change shows at once, before Convex confirms it. */
export function useSetEquipment() {
  return useMutation(api.equipment.set).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.equipment.get, {})
    if (!current) return
    store.setQuery(api.equipment.get, {}, {
      grinder: 'grinder' in args ? (args.grinder ?? '') : current.grinder,
      opusInner: args.opusInner ?? current.opusInner,
      opusDial: args.opusDial ?? current.opusDial,
    })
  })
}
