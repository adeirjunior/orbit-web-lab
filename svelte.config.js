import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    paths: { base: process.env.BASE_PATH || '' },
    adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
    serviceWorker: { register: true }
  }
};
