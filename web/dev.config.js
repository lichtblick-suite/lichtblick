// Development configuration for faster builds
module.exports = {
  // Disable heavy features for faster development
  disableMonacoEditor: process.env.DISABLE_MONACO_EDITOR === 'true',
  disableThreeDeeRender: process.env.DISABLE_THREE_DEE_RENDER === 'true',
  disableMoveItFeatures: process.env.DISABLE_MOVEIT_FEATURES === 'true',

  // Performance optimizations
  fastRefresh: process.env.FAST_REFRESH !== 'false',
  lazyLoading: process.env.ENABLE_LAZY_LOADING !== 'false',

  // Build optimizations
  disableSourceMaps: process.env.DISABLE_SOURCE_MAPS === 'true',
  skipTypeChecking: process.env.SKIP_TYPE_CHECKING === 'true',
};
