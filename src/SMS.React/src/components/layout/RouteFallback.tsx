import { SkeletonCards, SkeletonStats, SkeletonTable, Skeleton } from '../ui/States'
import type { ArchetypeName } from '../../design/archetypes'

/**
 * Suspense fallback for a lazily-loaded route.
 *
 * Shaped like the archetype it is standing in for, so a chunk fetch reads as
 * "the page is arriving" rather than "the app has stalled". A generic spinner
 * here would undo most of the benefit of code-splitting, because the user
 * would perceive a blank wait on every navigation instead of a layout
 * settling into place.
 */
export function RouteFallback({ archetype }: { archetype: ArchetypeName }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6" aria-busy="true">
      {/* Stand-in for the portalled page title, which has not mounted yet. */}
      <Skeleton variant="text" className="mb-6 h-5" width="220px" />

      {archetype === 'command' && (
        <div className="space-y-6">
          <SkeletonStats count={4} />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="surface-glass h-64 lg:col-span-2" />
            <div className="surface-glass h-64" />
          </div>
        </div>
      )}

      {archetype === 'ledger' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 max-w-xs" />
            <Skeleton className="h-10 w-32" />
          </div>
          <SkeletonTable rows={10} cols={6} />
        </div>
      )}

      {archetype === 'catalog' && <SkeletonCards count={8} />}

      {archetype === 'profile' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonTable rows={8} cols={4} />
          </div>
          <div className="surface-glass h-80" />
        </div>
      )}

      {archetype === 'config' && (
        <div className="mx-auto max-w-2xl space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="surface-glass space-y-3 p-5">
              <Skeleton variant="text" width="30%" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      )}

      {archetype === 'console' && (
        <div className="grid gap-4 lg:grid-cols-[40%_1fr]">
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <SkeletonCards count={4} className="!grid-cols-2" />
          </div>
          <div className="surface-glass h-96" />
        </div>
      )}
    </div>
  )
}
