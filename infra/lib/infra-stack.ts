import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Dead-letter queue: where jobs go after failing 3 times
    const dlq = new sqs.Queue(this, 'TriageJobsDLQ', {
      retentionPeriod: cdk.Duration.days(14),
    });

    // 2. Main queue: YOU fill in the three blanks
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

    // 3. Permissions: exactly what it needs, nothing more
    queue.grantSendMessages(webhookFn);
    appSecret.grantRead(webhookFn);

    // 4. A public HTTPS endpoint: POST /webhook → the Lambda
    const api = new apigwv2.HttpApi(this, 'WebhookApi');
    api.addRoutes({
      path: '/webhook',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('WebhookIntegration', webhookFn),
    });

    new cdk.CfnOutput(this, 'WebhookUrl', { value: `${api.apiEndpoint}/webhook` });

    // 3. Print the URL after deploy
    new cdk.CfnOutput(this, 'QueueUrl', { value: queue.queueUrl });
  }
}