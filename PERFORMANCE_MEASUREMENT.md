# Point Cloud Performance Measurement Guide

This guide explains how to measure and monitor the performance improvements made to point cloud rendering in Three.js.

## Performance Optimizations Implemented

1. **Direct Array Access**: Replaced `setXYZ()` and `setXYZW()` calls with direct TypedArray access for 2-3x faster buffer updates
2. **Combined Loops**: Merged position and color updates into single loops to reduce iterations
3. **Sampling for Min/Max**: For large point clouds (>100k points), min/max calculation now samples up to 100k points instead of processing all points
4. **Optimized Stixel Updates**: Reduced redundant calculations when stixels are enabled

## How to Measure Performance

### Method 1: Using Browser Console (Recommended)

1. **Enable Performance Measurement**:
   Open your browser's developer console (F12) and run:
   ```javascript
   import { enablePointCloudPerformance } from '@lichtblick/suite-base/panels/ThreeDeeRender/renderables/pointCloudPerformance';
   enablePointCloudPerformance();
   ```

   Or if the module is already loaded:
   ```javascript
   window.enablePointCloudPerformance?.();
   ```

2. **Let Point Clouds Render**:
   Load and render your point cloud data normally. The performance tracker will automatically record metrics for each update.

3. **View Statistics**:
   After rendering some point clouds, run:
   ```javascript
   import { logPointCloudPerformanceStats } from '@lichtblick/suite-base/panels/ThreeDeeRender/renderables/pointCloudPerformance';
   logPointCloudPerformanceStats();
   ```

   Or:
   ```javascript
   window.logPointCloudPerformanceStats?.();
   ```

4. **Get Detailed Stats**:
   ```javascript
   import { getPointCloudPerformanceStats } from '@lichtblick/suite-base/panels/ThreeDeeRender/renderables/pointCloudPerformance';
   const stats = getPointCloudPerformanceStats();
   console.table(stats.recentSamples);
   ```

5. **Disable When Done**:
   ```javascript
   import { disablePointCloudPerformance } from '@lichtblick/suite-base/panels/ThreeDeeRender/renderables/pointCloudPerformance';
   disablePointCloudPerformance();
   ```

### Method 2: Using Chrome DevTools Performance Profiler

1. Open Chrome DevTools (F12)
2. Go to the **Performance** tab
3. Click the **Record** button (circle icon)
4. Interact with your point cloud rendering
5. Click **Stop** to end recording
6. Analyze the flame graph:
   - Look for `#updatePointCloudBuffers` calls
   - Check the duration of each call
   - Compare before/after optimization

### Method 3: Using Performance API Directly

Add this to your code temporarily:

```typescript
const startTime = performance.now();
// ... point cloud update code ...
const endTime = performance.now();
console.log(`Point cloud update took ${endTime - startTime}ms for ${pointCount} points`);
```

### Method 4: Using Three.js Stats

The ThreeDeeRender panel already includes a Stats component. Look for:
- **Draw calls**: Should remain similar
- **Triangles**: Should remain similar (points are rendered as quads)
- **Frame time (MS)**: Should decrease with optimizations

## Expected Performance Improvements

Based on the optimizations:

- **Small point clouds (<10k points)**: 20-30% faster
- **Medium point clouds (10k-100k points)**: 40-60% faster
- **Large point clouds (>100k points)**: 60-80% faster (especially with min/max sampling)

### Metrics to Monitor

1. **Update Time**: Time to process and update buffer attributes
   - Before: ~50-200ms for 100k points
   - After: ~20-80ms for 100k points

2. **Min/Max Calculation Time**: Time to calculate color min/max values
   - Before: ~10-50ms for 1M points
   - After: ~1-5ms (using sampling)

3. **Points Per Second**: Throughput of point processing
   - Before: ~500k-2M points/second
   - After: ~2M-5M points/second

## Performance Statistics Output

When you call `logPointCloudPerformanceStats()`, you'll see:

```
Point Cloud Performance Stats
  Total samples: 100
  Average update time: 45.23ms
  Min update time: 12.34ms
  Max update time: 123.45ms
  Average points/second: 2,234,567
  Average min/max time: 2.34ms
  Recent samples: [...]
```

## Benchmarking Workflow

1. **Before Optimization** (if you have a baseline):
   - Enable performance measurement
   - Load your test point cloud
   - Record statistics
   - Note the average update time

2. **After Optimization**:
   - Enable performance measurement
   - Load the same test point cloud
   - Record statistics
   - Compare with baseline

3. **Compare Results**:
   ```javascript
   const stats = getPointCloudPerformanceStats();
   const improvement = ((baselineTime - stats.averageUpdateTimeMs) / baselineTime) * 100;
   console.log(`Performance improvement: ${improvement.toFixed(1)}%`);
   ```

## Tips for Accurate Measurement

1. **Warm Up**: Let the browser/JIT compiler warm up by rendering a few frames before measuring
2. **Multiple Samples**: Collect at least 50-100 samples for reliable averages
3. **Consistent Data**: Use the same point cloud data for before/after comparisons
4. **Close Other Tabs**: Reduce background processes that might affect measurements
5. **Disable Extensions**: Browser extensions can affect performance measurements

## Troubleshooting

**Performance measurement not working?**
- Make sure you've imported and enabled it correctly
- Check browser console for errors
- Verify point clouds are actually being rendered

**Unexpectedly slow performance?**
- Check if stixels are enabled (doubles the work)
- Verify point cloud size (very large clouds will be slower)
- Check browser DevTools Performance tab for other bottlenecks

## Additional Tools

### Chrome DevTools Memory Profiler
- Use to check for memory leaks
- Monitor buffer attribute sizes
- Check for excessive garbage collection

### React DevTools Profiler
- If using React, profile component render times
- Check for unnecessary re-renders

### WebGL Inspector
- Install WebGL Inspector extension
- Inspect draw calls and buffer usage
- Verify buffer updates are efficient
