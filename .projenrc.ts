const { awscdk } = require('projen');
const { JobPermission } = require('projen/lib/github/workflows-model');
const { UpgradeDependenciesSchedule } = require('projen/lib/javascript');
const AUTOMATION_TOKEN = 'PROJEN_GITHUB_TOKEN';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.101.0',
  defaultReleaseBranch: 'main',
  name: 'amazon-chime-sdk-meeting-summarizer',
  appEntrypoint: 'amazon-chime-sdk-meeting-summarizer.ts',
  license: 'MIT-0',
  author: 'Court Schuett',
  minorVersion: 1,
  copyrightOwner: 'Amazon.com, Inc.',
  authorAddress: 'https://aws.amazon.com',
  devDeps: ['esbuild'],
  projenrcTs: true,
  jest: false,
  deps: [
    'fs-extra',
    '@types/fs-extra',
    '@types/aws-lambda',
    'cdk-amazon-chime-resources',
    '@aws-sdk/client-chime-sdk-voice',
    '@aws-sdk/client-transcribe',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-bedrock-agent-runtime',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-scheduler',
    '@aws-sdk/s3-request-presigner',
    '@aws-sdk/client-bedrock-agent',
    '@aws-sdk/client-opensearchserverless',
    '@aws-sdk/credential-provider-node',
    '@aws-sdk/client-ssm',
    '@opensearch-project/opensearch',
    'esbuild',
    'aws-lambda',
    'dotenv',
    'moment',
    'moment-timezone',
  ],
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['schuettc'],
  },
  depsUpgradeOptions: {
    ignoreProjen: false,
    workflowOptions: {
      labels: ['auto-approve', 'auto-merge'],
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
  },
});

project.addTask('launch', {
  exec: 'yarn && yarn projen && yarn cdk bootstrap && yarn cdk deploy  --require-approval never && yarn configLocal',
});
project.addTask('getBucket', {
  exec: "aws cloudformation describe-stacks --stack-name AmazonChimeSDKMeetingSummarizer --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`siteBucket`].OutputValue' --output text",
});

project.addTask('configLocal', {
  exec: 'aws s3 cp s3://$(yarn run --silent getBucket)/config.json site/public/',
});

const upgradeSite = project.github.addWorkflow('upgrade-site');
upgradeSite.on({ schedule: [{ cron: '0 0 * * 1' }], workflowDispatch: {} });

upgradeSite.addJobs({
  upgradeSite: {
    runsOn: ['ubuntu-latest'],
    name: 'upgrade-site',
    permissions: {
      actions: JobPermission.WRITE,
      contents: JobPermission.READ,
      idToken: JobPermission.WRITE,
    },
    steps: [
      { uses: 'actions/checkout@v3' },
      {
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v3',
        with: {
          'node-version': '18',
        },
      },
      {
        run: 'yarn install --check-files --frozen-lockfile',
        workingDirectory: 'site',
      },
      { run: 'yarn upgrade', workingDirectory: 'site' },
      {
        name: 'Create Pull Request',
        uses: 'peter-evans/create-pull-request@v4',
        with: {
          'token': '${{ secrets.' + AUTOMATION_TOKEN + ' }}',
          'commit-message': 'chore: upgrade site',
          'branch': 'auto/projen-upgrade',
          'title': 'chore: upgrade site',
          'body': 'This PR upgrades site',
          'labels': 'auto-merge, auto-approve',
          'author': 'github-actions <github-actions@github.com>',
          'committer': 'github-actions <github-actions@github.com>',
          'signoff': true,
        },
      },
    ],
  },
});

project.tsconfigDev.file.addOverride('include', [
  'src/**/*.ts',
  'site/src/**/*.tsx',
  './.projenrc.ts',
]);

project.eslint.addOverride({
  files: ['site/src/**/*.tsx', 'src/resources/**/*.ts'],
  rules: {
    'indent': 'off',
    '@typescript-eslint/indent': 'off',
  },
});

const common_exclude = [
  'docker-compose.yaml',
  'cdk.out',
  'cdk.context.json',
  'yarn-error.log',
  'dependabot.yml',
  '.DS_Store',
  '.env',
  '**/dist/**',
  'config.json',
];

project.gitignore.exclude(...common_exclude);
project.synth();
