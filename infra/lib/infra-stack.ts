import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dlq = new sqs.Queue(this, 'TriageJobsDLQ', {
      retentionPeriod: cdk.Duration.days(14),
    });

    const queue = new sqs.Queue(this, 'TriageJobsQueue', {
      visibilityTimeout: cdk.Duration.minutes(5),      // 5 minutes, same pattern as days(14)
      deadLetterQueue: {
        queue: dlq,                // which queue receives the failed jobs?
        maxReceiveCount: 3,      // how many attempts before giving up?
      },
    });

    const webhookDir = path.join(__dirname, '../../apps/webhook');
    // 1. A reference to the secret you created by hand (CDK doesn't create or see its value)
    const appSecret = secretsmanager.Secret.fromSecretNameV2(this, 'AppSecret', 'ci-triage/app');
    const privateKeySecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'PrivateKeySecret', 'ci-triage/github-private-key',
    );
    // 2. The webhook Lambda
    const webhookFn = new NodejsFunction(this, 'WebhookFn', {
      entry: path.join(webhookDir, 'src/lambda.ts'),
      handler: 'handler',
      projectRoot: webhookDir,
      depsLockFilePath: path.join(webhookDir, 'package-lock.json'),
      runtime: lambda.Runtime.NODEJS_24_X,   // if this doesn't exist in your CDK version, use NODEJS_22_X
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        QUEUE_URL: queue.queueUrl,
        APP_SECRET_NAME: 'ci-triage/app',
      },
    });

    queue.grantSendMessages(webhookFn);
    appSecret.grantRead(webhookFn);

    const api = new apigwv2.HttpApi(this, 'WebhookApi');
    api.addRoutes({
      path: '/webhook',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('WebhookIntegration', webhookFn),
    });

    const workerDir = path.join(__dirname, '../../apps/worker');
    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      entry: path.join(workerDir, 'src/handler.ts'),
      handler: 'handler',
      projectRoot: workerDir,
      depsLockFilePath: path.join(workerDir, 'package-lock.json'),
      runtime: lambda.Runtime.NODEJS_24_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(50),   // ≤ queue visibility (300 s) / 6
      environment: {
        GITHUB_APP_ID: '5196825',
        APP_SECRET_NAME: 'ci-triage/app',
        PRIVATE_KEY_SECRET_NAME: 'ci-triage/github-private-key',
        AGENT: 'tools',
      },
    });
    appSecret.grantRead(workerFn);
    privateKeySecret.grantRead(workerFn);   // only the worker can read the private key

    workerFn.addEventSource(new SqsEventSource(queue, {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 2,
    })); 

    new cdk.CfnOutput(this, 'WebhookUrl', { value: `${api.apiEndpoint}/webhook` });
    new cdk.CfnOutput(this, 'QueueUrl', { value: queue.queueUrl });
  }
}