#!/bin/sh
set -e

depcruise packages apps/api
for app in web customer-app courier-app; do
  DEPCRUISE_APP="apps/$app" depcruise "apps/$app"
done
