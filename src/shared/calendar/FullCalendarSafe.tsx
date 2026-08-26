import FullCalendar from '@fullcalendar/react'

/**
 * FullCalendar's React connector calls `updateSize()` from a `setState`
 * callback during React's commit phase. That path `flushSync`s custom
 * event content (JSX `eventContent`) and React 18+ warns:
 * "flushSync was called from inside a lifecycle method".
 *
 * Defer the resize to a microtask so it runs after the current commit.
 * See https://github.com/fullcalendar/fullcalendar/issues/7448
 */
export default class FullCalendarSafe extends FullCalendar {
  #mounted = false

  componentDidMount() {
    this.#mounted = true
    super.componentDidMount()
  }

  componentWillUnmount() {
    this.#mounted = false
    super.componentWillUnmount()
  }

  doResize() {
    queueMicrotask(() => {
      if (!this.#mounted) return
      super.doResize()
    })
  }
}
