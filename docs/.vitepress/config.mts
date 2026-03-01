import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Single Notion",
  description: "Description",
  base: '/docs/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: '가이드', link: '/guides/deployment' },
      { text: 'API', link: '/api/endpoints' },
      { text: '아키텍처', link: '/architecture/overview' },
      { text: '로드맵', link: '/roadmap' }
    ],

    sidebar: [
      {
        text: 'Architecture',
        items: [
          { text: 'Overview', link: '/architecture/overview' },
          { text: 'Logging', link: '/architecture/logging' },
          { text: 'Security', link: '/architecture/security' }
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: 'Deployment', link: '/guides/deployment' },
          { text: 'Frontend', link: '/guides/frontend' }
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Endpoints', link: '/api/endpoints' }
        ]
      },
      {
        text: 'Test',
        items: [
          { text: 'Starting Test', link: '/test/starting_test' }
        ]
      },
      {
        text: 'Project',
        items: [
          { text: 'Roadmap', link: '/roadmap' },
          { text: 'Documentation Policy', link: '/documentation_policy' },
          { text: 'ADR: BullMQ 도입', link: '/adr/0001-use-bullmq-for-queue' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cld338/SingleNotion' }
    ]
  }
})
