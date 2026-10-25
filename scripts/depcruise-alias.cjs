const path = require('node:path');

// .dependency-cruiser.cjs から読む。各 app の tsconfig の paths（`@/*` → `./src/*`）と揃える。
module.exports = {
  resolve: {
    alias: { '@': path.resolve(process.env.DEPCRUISE_APP, 'src') },
  },
};
