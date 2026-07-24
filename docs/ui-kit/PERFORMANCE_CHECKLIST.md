
# Performance Checklist

- [ ] Use 1× background on normal phones and 2× only when necessary.
- [ ] Lazy-load countdown frames and stopwatch art.
- [ ] Stop fire-ring timers when hidden/unmounted.
- [ ] Stop ember animation when screen loses focus.
- [ ] Memoize card and lane components only where profiling supports it.
- [ ] Avoid selectors that return new arrays/objects every render.
- [ ] Avoid nested pressables and duplicate listeners.
- [ ] Preload active arena assets.
- [ ] Profile gameplay input on a lower-end Android device.
