export type DiscordVerificationResponse = {
  verified: boolean;
  info?: {
    username: string;
    imageURI: string;
    accessToken: string;
  };
  erroeMessage?: string;
};

export type DiscordResponseParams = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
};

export type DiscordUserInfoParams = {
  id: string;
  username: string;
  avatar: string;
  discriminator: string;
};

export type GithubResponseParams = {
  access_token: string;
  scope: string;
  token_type: string;
};

export type GithubUserInfoParams = {
  login: string;
  avatar_url: string;
};
