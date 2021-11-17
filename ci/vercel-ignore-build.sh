#!/bin/bash

# Since vercel does not any any way to disable the preview build feature, we use the ignore build
# step feature to only deploy the main branch.
# https://vercel.com/support/articles/how-do-i-use-the-ignored-build-step-field-on-vercel#with-environment-variables

# To deploy only on the main branch, remove this line and uncomment the code below.
exit 1

# echo "VERCEL_GIT_COMMIT_REF: $VERCEL_GIT_COMMIT_REF"
#
# if [[ "$VERCEL_GIT_COMMIT_REF" == "main"  ]] ; then
#   # Proceed with the build
#   echo "✅ - Deploy"
#   exit 1;
#
# else
#   # Don't build
#   echo "🛑 - Build cancelled"
#   exit 0;
# fi
