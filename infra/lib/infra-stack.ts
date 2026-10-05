import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';

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

    // 3. Print the URL after deploy
    new cdk.CfnOutput(this, 'QueueUrl', { value: queue.queueUrl });
  }
}