import {
  createS3Client,
  createS3ClientFromEnv,
  type EnvReader,
  parseS3Config,
  processEnvReader,
} from "./s3";

// S3Client를 가짜로 — 실제 네트워크 없이 생성 인자만 검증.
jest.mock("@aws-sdk/client-s3", () => {
  const ctor = jest.fn();
  return { __esModule: true, S3Client: ctor };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { S3Client } = require("@aws-sdk/client-s3") as { S3Client: jest.Mock };

function reader(map: Record<string, string>): EnvReader {
  return {
    required(key) {
      const v = map[key];
      if (!v) throw new Error(`missing env: ${key}`);
      return v;
    },
    optional(key) {
      return map[key];
    },
  };
}

const FULL = {
  S3_ENDPOINT: "http://minio:9000",
  S3_ACCESS_KEY: "ak",
  S3_SECRET_KEY: "sk",
};

describe("parseS3Config", () => {
  it("기본값: region=us-east-1, forcePathStyle=true", () => {
    expect(parseS3Config(reader(FULL))).toEqual({
      endpoint: "http://minio:9000",
      region: "us-east-1",
      forcePathStyle: true,
      accessKeyId: "ak",
      secretAccessKey: "sk",
    });
  });

  it('forcePathStyle: "false"만 false, 그 외는 true', () => {
    expect(parseS3Config(reader({ ...FULL, S3_FORCE_PATH_STYLE: "false" })).forcePathStyle).toBe(false);
    expect(parseS3Config(reader({ ...FULL, S3_FORCE_PATH_STYLE: "true" })).forcePathStyle).toBe(true);
    expect(parseS3Config(reader({ ...FULL, S3_FORCE_PATH_STYLE: "anything" })).forcePathStyle).toBe(true);
  });

  it("region env 우선", () => {
    expect(parseS3Config(reader({ ...FULL, S3_REGION: "ap-northeast-2" })).region).toBe("ap-northeast-2");
  });

  it("필수 env 누락 시 throw", () => {
    expect(() => parseS3Config(reader({ S3_ACCESS_KEY: "ak", S3_SECRET_KEY: "sk" }))).toThrow(/S3_ENDPOINT/);
  });
});

describe("createS3Client", () => {
  beforeEach(() => S3Client.mockClear());

  it("S3Config를 S3Client 생성 인자로 매핑", () => {
    createS3Client({
      endpoint: "http://minio:9000",
      region: "us-east-1",
      forcePathStyle: true,
      accessKeyId: "ak",
      secretAccessKey: "sk",
    });
    expect(S3Client).toHaveBeenCalledWith({
      endpoint: "http://minio:9000",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "ak", secretAccessKey: "sk" },
    });
  });

  it("createS3ClientFromEnv: parse+create 결합", () => {
    createS3ClientFromEnv(reader(FULL));
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "http://minio:9000", region: "us-east-1" }),
    );
  });
});

describe("processEnvReader", () => {
  const OLD = process.env;
  afterEach(() => {
    process.env = OLD;
  });

  it("required: 없으면 throw, optional: 없으면 undefined", () => {
    process.env = { ...OLD, S3_ENDPOINT: "http://x:9000" };
    expect(processEnvReader.required("S3_ENDPOINT")).toBe("http://x:9000");
    expect(processEnvReader.optional("S3_MISSING_KEY_TEST")).toBeUndefined();
    expect(() => processEnvReader.required("S3_MISSING_KEY_TEST")).toThrow(/missing env/);
  });
});
