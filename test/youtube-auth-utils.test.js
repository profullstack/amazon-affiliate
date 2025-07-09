import { expect } from 'chai';
import sinon from 'sinon';
import { google } from 'googleapis';
import {
  validateYouTubeEnvironment,
  createAndTestYouTubeAuth,
  ensureYouTubeAuthentication,
  isYouTubeAuthenticationValid,
  getYouTubeChannelInfo
} from '../src/youtube-auth-utils.js';

describe('YouTube Authentication Utils', () => {
  let originalEnv;
  let consoleLogStub;
  let authenticateYouTubeStub;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Stub console.log to prevent test output noise
    consoleLogStub = sinon.stub(console, 'log');
    
    // Mock the authenticateYouTube function
    authenticateYouTubeStub = sinon.stub();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    
    // Restore stubs
    sinon.restore();
  });

  describe('validateYouTubeEnvironment', () => {
    it('should return valid when all required environment variables are present', () => {
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';
      process.env.YOUTUBE_OAUTH2_REFRESH_TOKEN = 'test-refresh-token';

      const result = validateYouTubeEnvironment();

      expect(result.isValid).to.be.true;
      expect(result.missing).to.be.empty;
      expect(result.hasRefreshToken).to.be.true;
    });

    it('should return invalid when CLIENT_ID is missing', () => {
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';
      delete process.env.YOUTUBE_CLIENT_ID;

      const result = validateYouTubeEnvironment();

      expect(result.isValid).to.be.false;
      expect(result.missing).to.include('YOUTUBE_CLIENT_ID');
    });

    it('should return invalid when CLIENT_SECRET is missing', () => {
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';
      delete process.env.YOUTUBE_CLIENT_SECRET;

      const result = validateYouTubeEnvironment();

      expect(result.isValid).to.be.false;
      expect(result.missing).to.include('YOUTUBE_CLIENT_SECRET');
    });

    it('should return invalid when ACCESS_TOKEN is missing', () => {
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      delete process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN;

      const result = validateYouTubeEnvironment();

      expect(result.isValid).to.be.false;
      expect(result.missing).to.include('YOUTUBE_OAUTH2_ACCESS_TOKEN');
    });

    it('should handle missing refresh token gracefully', () => {
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';
      delete process.env.YOUTUBE_OAUTH2_REFRESH_TOKEN;

      const result = validateYouTubeEnvironment();

      expect(result.isValid).to.be.true;
      expect(result.hasRefreshToken).to.be.false;
    });

    it('should identify multiple missing variables', () => {
      delete process.env.YOUTUBE_CLIENT_ID;
      delete process.env.YOUTUBE_CLIENT_SECRET;
      delete process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN;

      const result = validateYouTubeEnvironment();

      expect(result.isValid).to.be.false;
      expect(result.missing).to.have.length(3);
      expect(result.missing).to.include.members([
        'YOUTUBE_CLIENT_ID',
        'YOUTUBE_CLIENT_SECRET',
        'YOUTUBE_OAUTH2_ACCESS_TOKEN'
      ]);
    });
  });

  describe('createAndTestYouTubeAuth', () => {
    let googleAuthStub;
    let youtubeStub;
    let channelsListStub;

    beforeEach(() => {
      // Set up environment
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';
      process.env.YOUTUBE_OAUTH2_REFRESH_TOKEN = 'test-refresh-token';

      // Mock Google OAuth2
      const mockOAuth2Client = {
        setCredentials: sinon.stub()
      };
      googleAuthStub = sinon.stub(google.auth, 'OAuth2').returns(mockOAuth2Client);

      // Mock YouTube API
      channelsListStub = sinon.stub();
      youtubeStub = sinon.stub(google, 'youtube').returns({
        channels: {
          list: channelsListStub
        }
      });
    });

    it('should return success with valid authentication', async () => {
      const mockChannelData = {
        data: {
          items: [{
            snippet: { title: 'Test Channel' },
            statistics: { 
              subscriberCount: '1000',
              videoCount: '50'
            }
          }]
        }
      };
      channelsListStub.resolves(mockChannelData);

      const result = await createAndTestYouTubeAuth();

      expect(result.success).to.be.true;
      expect(result.oauth2Client).to.exist;
      expect(result.channel).to.deep.equal({
        title: 'Test Channel',
        subscribers: '1000',
        videos: '50'
      });
      expect(result.error).to.be.undefined;
    });

    it('should handle missing subscriber count gracefully', async () => {
      const mockChannelData = {
        data: {
          items: [{
            snippet: { title: 'Test Channel' },
            statistics: { 
              videoCount: '50'
            }
          }]
        }
      };
      channelsListStub.resolves(mockChannelData);

      const result = await createAndTestYouTubeAuth();

      expect(result.success).to.be.true;
      expect(result.channel.subscribers).to.equal('Hidden');
      expect(result.channel.videos).to.equal('50');
    });

    it('should handle missing video count gracefully', async () => {
      const mockChannelData = {
        data: {
          items: [{
            snippet: { title: 'Test Channel' },
            statistics: { 
              subscriberCount: '1000'
            }
          }]
        }
      };
      channelsListStub.resolves(mockChannelData);

      const result = await createAndTestYouTubeAuth();

      expect(result.success).to.be.true;
      expect(result.channel.subscribers).to.equal('1000');
      expect(result.channel.videos).to.equal('0');
    });

    it('should return failure when no channel data is found', async () => {
      const mockChannelData = {
        data: {
          items: []
        }
      };
      channelsListStub.resolves(mockChannelData);

      const result = await createAndTestYouTubeAuth();

      expect(result.success).to.be.false;
      expect(result.error).to.equal('No channel data found');
      expect(result.oauth2Client).to.be.null;
      expect(result.channel).to.be.null;
    });

    it('should return failure when API call throws error', async () => {
      const apiError = new Error('API quota exceeded');
      channelsListStub.rejects(apiError);

      const result = await createAndTestYouTubeAuth();

      expect(result.success).to.be.false;
      expect(result.error).to.equal('API quota exceeded');
      expect(result.oauth2Client).to.be.null;
      expect(result.channel).to.be.null;
    });

    it('should create OAuth2 client with correct parameters', async () => {
      const mockChannelData = {
        data: {
          items: [{
            snippet: { title: 'Test Channel' },
            statistics: {}
          }]
        }
      };
      channelsListStub.resolves(mockChannelData);

      await createAndTestYouTubeAuth();

      expect(googleAuthStub).to.have.been.calledWith(
        'test-client-id',
        'test-client-secret',
        'http://localhost:8080/oauth2callback'
      );
    });
  });

  describe('isYouTubeAuthenticationValid', () => {
    it('should return true when authentication is valid', async () => {
      // Set up valid environment
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';

      // Mock successful authentication test
      const mockOAuth2Client = { setCredentials: sinon.stub() };
      sinon.stub(google.auth, 'OAuth2').returns(mockOAuth2Client);
      
      const channelsListStub = sinon.stub().resolves({
        data: {
          items: [{
            snippet: { title: 'Test Channel' },
            statistics: {}
          }]
        }
      });
      
      sinon.stub(google, 'youtube').returns({
        channels: { list: channelsListStub }
      });

      const result = await isYouTubeAuthenticationValid();

      expect(result).to.be.true;
    });

    it('should return false when environment is invalid', async () => {
      // Clear environment variables
      delete process.env.YOUTUBE_CLIENT_ID;
      delete process.env.YOUTUBE_CLIENT_SECRET;
      delete process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN;

      const result = await isYouTubeAuthenticationValid();

      expect(result).to.be.false;
    });

    it('should return false when authentication test fails', async () => {
      // Set up valid environment
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';

      // Mock failed authentication test
      const mockOAuth2Client = { setCredentials: sinon.stub() };
      sinon.stub(google.auth, 'OAuth2').returns(mockOAuth2Client);
      
      const channelsListStub = sinon.stub().rejects(new Error('Authentication failed'));
      sinon.stub(google, 'youtube').returns({
        channels: { list: channelsListStub }
      });

      const result = await isYouTubeAuthenticationValid();

      expect(result).to.be.false;
    });
  });

  describe('getYouTubeChannelInfo', () => {
    it('should return channel info when authentication is valid', async () => {
      // Set up valid environment
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';

      // Mock successful authentication test
      const mockOAuth2Client = { setCredentials: sinon.stub() };
      sinon.stub(google.auth, 'OAuth2').returns(mockOAuth2Client);
      
      const channelsListStub = sinon.stub().resolves({
        data: {
          items: [{
            snippet: { title: 'Test Channel' },
            statistics: { 
              subscriberCount: '1000',
              videoCount: '50'
            }
          }]
        }
      });
      
      sinon.stub(google, 'youtube').returns({
        channels: { list: channelsListStub }
      });

      const result = await getYouTubeChannelInfo();

      expect(result).to.deep.equal({
        title: 'Test Channel',
        subscribers: '1000',
        videos: '50'
      });
    });

    it('should return null when authentication fails', async () => {
      // Set up valid environment
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN = 'test-access-token';

      // Mock failed authentication test
      const mockOAuth2Client = { setCredentials: sinon.stub() };
      sinon.stub(google.auth, 'OAuth2').returns(mockOAuth2Client);
      
      const channelsListStub = sinon.stub().rejects(new Error('Authentication failed'));
      sinon.stub(google, 'youtube').returns({
        channels: { list: channelsListStub }
      });

      const result = await getYouTubeChannelInfo();

      expect(result).to.be.null;
    });
  });
});