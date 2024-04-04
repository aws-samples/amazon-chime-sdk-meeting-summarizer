# Getting Started

This getting started guide will walk you through setting up a new CDK project.

## Pre-requisites

Before diving into the project setup, make sure you have the following requirements in place:

- **Yarn**: [Yarn](https://classic.yarn.pkg.com/lang/en/docs/install) must be installed on your machine. 
- **AWS Account**: You'll need an active AWS account.
- **Anthropic Models**: These models should be enabled in your AWS Account. Learn more about enabling them [here](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html).
- **Amazon Titan**: Ensure that Amazon Titan is activated in your AWS Account. Learn more about enabling them [here](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-models.html).

## Setting Up Your Project

To effectively utilize the `Amazon Chime SDK Meeting Summarizer`, your environment should have [Node.js](https://nodejs.org/en/) and [Yarn](https://classic.yarn.pkg.com/lang/en/docs/install) pre-installed.

Follow the below instructions to deploy the solution:

### Deployment Process

Execute the following command in your terminal to deploy the project:

```
yarn launch
```

Example output:

```
test
```

### Clean-up Process

To remove the deployed resources and clean up your environment, use:

```
yarn cdk destroy
```

This guide aims to provide a clear path for setting up your CDK project. Should you encounter any issues or have questions, feel free to open an issue [here](https://github.com/aws-samples/amazon-chime-sdk-meeting-summarizer/issues).