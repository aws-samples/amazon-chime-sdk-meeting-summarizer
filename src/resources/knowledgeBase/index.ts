import {
    CdkCustomResourceEvent,
    CdkCustomResourceResponse,
    Context,
  } from 'aws-lambda';
  
  import {
    createKnowledgeBase,
    createDataSource,
    updateKnowledgeBase,
    deleteKnowledgeBase,
  } from './bedrock';
  import { createIndex } from './openSearch';
  import {
    createAccessPolicy,
    createEncryptionSecurityPolicy,
    createNetworkSecurityPolicy,
    createCollection,
    updateCollection,
    deleteAccessPolicy,
    deleteSecurityPolicy,
    deleteCollection,
  } from './openSearchServerless';
  import { deleteParameter } from './utils';
  
  let response: CdkCustomResourceResponse = {};
  
  export const handler = async (
    event: CdkCustomResourceEvent,
    context: Context,
  ): Promise<CdkCustomResourceResponse> => {
    console.info('event: ', event);
  
    const requestType = event.RequestType;
    const requestProperties = event.ResourceProperties;
  
    switch (requestType) {
      case 'Create':
        console.log('Create');
        await createAccessPolicy({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
          knowledgeBaseRoleArn: requestProperties.knowledgeBaseRoleArn,
          knowledgeBaseCustomResourceRole:
            requestProperties.knowledgeBaseCustomResourceRole,
          accessPolicyArns: requestProperties.accessPolicyArns,
        });
        await createNetworkSecurityPolicy({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        await createEncryptionSecurityPolicy({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        const collection = await createCollection({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        await createIndex({
          host: collection.collectionEndpoint!,
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        const knowledgeBase = await createKnowledgeBase({
          knowledgeBaseRoleArn: requestProperties.knowledgeBaseRoleArn,
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
          knowledgeBaseEmbeddingModelArn:
            requestProperties.knowledgeBaseEmbeddingModelArn,
          collectionArn: collection.arn!,
        });
        const dataSource = await createDataSource({
          bucketArn: requestProperties.bucketArn,
          knowledgeBaseId: knowledgeBase.knowledgeBase?.knowledgeBaseId!,
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
  
        response.Data = {
          collectionArn: collection.arn!,
          collectionId: collection.id!,
          collectionName: collection.name!,
          collectionEndpoint: collection.collectionEndpoint,
          dataSourceId: dataSource?.dataSource?.dataSourceId,
          knowledgeBaseId: knowledgeBase.knowledgeBase?.knowledgeBaseId,
        };
        response.Status = 'SUCCESS';
        response.Reason = 'CreateKnowledgeBase successful';
  
        break;
      case 'Update':
        console.log('Update KnowledgeBase - NOOP');
        const collectionInfo = await updateCollection({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        const knowledgeBaseInfo = await updateKnowledgeBase({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        response.Data = {
          collectionArn: collectionInfo.collectionArn,
          collectionId: collectionInfo.collectionId,
          collectionName: collectionInfo.collectionName,
          collectionEndpoint: collectionInfo.collectionEndpoint,
          dataSourceId: knowledgeBaseInfo.dataSourceId,
          knowledgeBaseId: knowledgeBaseInfo.knowledgeBaseId,
        };
        response.Status = 'SUCCESS';
        response.Reason = 'UpdateKnowledgeBase successful';
        break;
      case 'Delete':
        console.log('Delete KnowledgeBase');
        await deleteAccessPolicy({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        await deleteSecurityPolicy({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
          type: 'network',
        });
        await deleteSecurityPolicy({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
          type: 'encryption',
        });
        await deleteCollection({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        await deleteKnowledgeBase({
          nameSuffix: requestProperties.nameSuffix,
          namePrefix: requestProperties.namePrefix,
        });
        await deleteParameter({
          name: `/${requestProperties.namePrefix}-${requestProperties.nameSuffix}/collectionArn`,
        });
        await deleteParameter({
          name: `/${requestProperties.namePrefix}-${requestProperties.nameSuffix}/collectionEndpoint`,
        });
        await deleteParameter({
          name: `/${requestProperties.namePrefix}-${requestProperties.nameSuffix}/collectionId`,
        });
        await deleteParameter({
          name: `/${requestProperties.namePrefix}-${requestProperties.nameSuffix}/collectionName`,
        });
        await deleteParameter({
          name: `/${requestProperties.namePrefix}-${requestProperties.nameSuffix}/dataSourceId`,
        });
        await deleteParameter({
          name: `/${requestProperties.namePrefix}-${requestProperties.nameSuffix}/knowledgeBaseArn`,
        });
        await deleteParameter({
          name: `/${requestProperties.namePrefix}-${requestProperties.nameSuffix}/knowledgeBaseId`,
        });
  
        response.Status = 'SUCCESS';
        response.Reason = 'DeleteKnowledgeBase successful';
        break;
    }
  
    response.StackId = event.StackId;
    response.RequestId = event.RequestId;
    response.LogicalResourceId = event.LogicalResourceId;
    response.PhysicalResourceId = context.logGroupName;
  
    console.log(`Response: ${JSON.stringify(response)}`);
    return response;
  };