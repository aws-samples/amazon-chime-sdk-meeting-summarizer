import {
    SSMClient,
    PutParameterCommand,
    GetParameterCommand,
    DeleteParameterCommand,
  } from '@aws-sdk/client-ssm';
  
  const AWS_REGION = process.env.AWS_REGION;
  const ssmClient = new SSMClient({ region: AWS_REGION });
  
  interface StoreParameterParams {
    name: string;
    value: string;
    description?: string;
  }
  
  export const storeParameters = async (params: StoreParameterParams) => {
    const { name, value, description } = params;
    console.log(`Store Parameters - ${name}`);
  
    try {
      await ssmClient.send(
        new PutParameterCommand({
          Type: 'String',
          Name: name,
          Value: value,
          Overwrite: true,
          Description: description,
        }),
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(error);
      }
      throw new Error(`Failed to put parameter - ${name}`);
    }
  };
  
  interface RetrieveParameterParams {
    name: string;
  }
  
  export const retrieveParameters = async (
    params: RetrieveParameterParams,
  ): Promise<string> => {
    const { name } = params;
    console.log(`Store Parameters - ${name}`);
  
    try {
      const getParameterResponse = await ssmClient.send(
        new GetParameterCommand({
          Name: name,
        }),
      );
      if (getParameterResponse.Parameter?.Value) {
        return getParameterResponse.Parameter?.Value;
      } else {
        throw new Error(`Failed to retrieve parameter - ${name}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error);
      }
      throw new Error(`Failed to retrieve parameter - ${name}`);
    }
  };
  
  interface DeleteParameterParams {
    name: string;
  }
  export const deleteParameter = async (params: DeleteParameterParams) => {
    const { name } = params;
    console.log(`Delete Parameter - ${name}`);
    try {
      await ssmClient.send(
        new DeleteParameterCommand({
          Name: name,
        }),
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(error);
      }
      throw new Error(`Failed to delete parameter - ${name}`);
    }
  };