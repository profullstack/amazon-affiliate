import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs/promises';
import { generateVoiceover, getRandomVoice, getMaleVoices, getFemaleVoices, VOICES } from '../src/voiceover-generator.js';

describe('Voiceover Generator', () => {
  describe('generateVoiceover', () => {
    let fetchStub;
    let fsStub;
    let processEnvStub;

    beforeEach(() => {
      // Mock fetch
      fetchStub = sinon.stub(global, 'fetch');
      
      // Mock fs
      fsStub = {
        writeFile: sinon.stub(fs, 'writeFile'),
        mkdir: sinon.stub(fs, 'mkdir'),
        stat: sinon.stub(fs, 'stat')
      };
      
      // Mock process.env
      processEnvStub = sinon.stub(process, 'env').value({
        ELEVENLABS_API_KEY: 'test-api-key'
      });

      // Mock successful API response
      fetchStub.resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(new ArrayBuffer(2048))
      });

      fsStub.mkdir.resolves();
      fsStub.writeFile.resolves();
      fsStub.stat.resolves({ size: 2048 });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should generate voiceover from text and return file path', async () => {
      const text = 'This is a test product description for voiceover generation.';
      const expectedPath = 'temp/voiceover.mp3';

      const result = await generateVoiceover(text);

      expect(result).to.equal(expectedPath);
      expect(fetchStub).to.have.been.calledOnce;
      expect(fsStub.writeFile).to.have.been.calledOnce;
    });

    it('should use custom output path when provided', async () => {
      const text = 'Test text';
      const customPath = 'custom/path/audio.mp3';

      const result = await generateVoiceover(text, customPath);

      expect(result).to.equal(customPath);
    });

    it('should throw error when API key is missing', async () => {
      processEnvStub.value({});

      try {
        await generateVoiceover('Test text');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('ELEVENLABS_API_KEY is required');
      }
    });

    it('should throw error when text is empty or invalid', async () => {
      const invalidTexts = ['', null, undefined, '   '];

      for (const text of invalidTexts) {
        try {
          await generateVoiceover(text);
          expect.fail(`Should have thrown an error for text: ${text}`);
        } catch (error) {
          expect(error.message).to.include('Text is required');
        }
      }
    });

    it('should handle API error responses', async () => {
      fetchStub.resolves({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: sinon.stub().resolves('Invalid API key')
      });

      try {
        await generateVoiceover('Test text');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Eleven Labs API error');
        expect(error.message).to.include('401');
      }
    });

    it('should handle network errors', async () => {
      fetchStub.rejects(new Error('Network timeout'));

      try {
        await generateVoiceover('Test text');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate voiceover');
        expect(error.message).to.include('Network timeout');
      }
    });

    it('should preprocess text by removing excessive whitespace', async () => {
      const messyText = '  This   is    a   test   with   lots   of   spaces.  \n\n  ';
      const expectedCleanText = 'This is a test with lots of spaces.';

      await generateVoiceover(messyText);

      const apiCall = fetchStub.getCall(0);
      const requestBody = JSON.parse(apiCall.args[1].body);
      expect(requestBody.text).to.equal(expectedCleanText);
    });

    it('should truncate text if it exceeds maximum length', async () => {
      const longText = 'A'.repeat(6000); // Exceeds typical API limits
      
      await generateVoiceover(longText);

      const apiCall = fetchStub.getCall(0);
      const requestBody = JSON.parse(apiCall.args[1].body);
      expect(requestBody.text.length).to.be.lessThan(5000);
    });

    it('should use correct API endpoint and headers with random voice', async () => {
      const text = 'Test text';
      const expectedHeaders = {
        'Accept': 'audio/mpeg',
        'xi-api-key': 'test-api-key',
        'Content-Type': 'application/json'
      };

      await generateVoiceover(text);

      // Check that the URL contains the base endpoint
      const actualCall = fetchStub.getCall(0);
      const actualUrl = actualCall.args[0];
      expect(actualUrl).to.match(/^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/.+/);
      
      // Check that the voice ID is one from our VOICES array
      const voiceId = actualUrl.split('/').pop();
      const voiceIds = Object.values(VOICES);
      expect(voiceIds).to.include(voiceId);

      expect(fetchStub).to.have.been.calledWith(actualUrl, {
        method: 'POST',
        headers: expectedHeaders,
        body: sinon.match.string
      });
    });

    it('should include voice settings in API request', async () => {
      const text = 'Test text';

      await generateVoiceover(text);

      const apiCall = fetchStub.getCall(0);
      const requestBody = JSON.parse(apiCall.args[1].body);
      
      expect(requestBody).to.have.property('voice_settings');
      expect(requestBody.voice_settings).to.have.property('stability');
      expect(requestBody.voice_settings).to.have.property('similarity_boost');
    });

    it('should handle file write errors', async () => {
      fsStub.writeFile.rejects(new Error('Disk full'));

      try {
        await generateVoiceover('Test text');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to save voiceover file');
      }
    });

    it('should validate generated file size', async () => {
      fsStub.stat.resolves({ size: 0 }); // Empty file

      try {
        await generateVoiceover('Test text');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Generated voiceover file is empty');
      }
    });

    it('should use custom voice settings when provided', async () => {
      const text = 'Test text';
      const customSettings = {
        stability: 0.8,
        similarity_boost: 0.9,
        style: 0.5
      };

      await generateVoiceover(text, undefined, customSettings);

      const apiCall = fetchStub.getCall(0);
      const requestBody = JSON.parse(apiCall.args[1].body);
      
      expect(requestBody.voice_settings).to.deep.equal(customSettings);
    });

    it('should retry on temporary API failures', async () => {
      fetchStub.onFirstCall().rejects(new Error('Temporary failure'));
      fetchStub.onSecondCall().resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(new ArrayBuffer(2048))
      });

      const result = await generateVoiceover('Test text');

      expect(result).to.equal('temp/voiceover.mp3');
      expect(fetchStub).to.have.been.calledTwice;
    });
  });

  describe('getRandomVoice', () => {
    it('should return a valid voice ID from the VOICES array', () => {
      const voiceId = getRandomVoice();
      const voiceIds = Object.values(VOICES);
      
      expect(voiceIds).to.include(voiceId);
      expect(voiceId).to.be.a('string');
      expect(voiceId).to.have.length.greaterThan(0);
    });

    it('should return different voices on multiple calls (probabilistic test)', () => {
      const results = new Set();
      
      // Call getRandomVoice multiple times to increase chance of getting different voices
      for (let i = 0; i < 50; i++) {
        results.add(getRandomVoice());
      }
      
      // With 10 voices and 50 calls, we should get at least 2 different voices
      expect(results.size).to.be.greaterThan(1);
    });

    it('should always return a voice ID that exists in the VOICES object', () => {
      const voiceIds = Object.values(VOICES);
      
      for (let i = 0; i < 20; i++) {
        const selectedVoice = getRandomVoice();
        expect(voiceIds).to.include(selectedVoice);
      }
    });
  });

  describe('VOICES constant', () => {
    it('should contain all expected voice names', () => {
      const expectedVoiceNames = [
        'antoni', 'adam', 'sam', 'jake', 'drew',
        'rachel', 'bella', 'elli', 'grace', 'charlotte'
      ];
      
      const actualVoiceNames = Object.keys(VOICES);
      expect(actualVoiceNames).to.have.members(expectedVoiceNames);
    });

    it('should have valid voice IDs for all voices', () => {
      Object.entries(VOICES).forEach(([name, id]) => {
        expect(id).to.be.a('string');
        expect(id).to.have.length.greaterThan(10); // ElevenLabs voice IDs are typically longer
        expect(name).to.be.a('string');
        expect(name).to.have.length.greaterThan(0);
      });
    });

    it('should contain both male and female voices', () => {
      const maleVoices = ['antoni', 'adam', 'sam', 'jake', 'drew'];
      const femaleVoices = ['rachel', 'bella', 'elli', 'grace', 'charlotte'];
      
      maleVoices.forEach(voice => {
        expect(VOICES).to.have.property(voice);
      });
      
      femaleVoices.forEach(voice => {
        expect(VOICES).to.have.property(voice);
      });
    });
  });

  describe('Voice Gender Selection', () => {
    describe('getMaleVoices', () => {
      it('should return only male voices', () => {
        const maleVoices = getMaleVoices();
        const expectedMaleVoices = ['antoni', 'adam', 'sam', 'jake', 'drew'];
        
        expect(Object.keys(maleVoices)).to.have.members(expectedMaleVoices);
        expect(Object.keys(maleVoices)).to.have.length(5);
      });

      it('should return valid voice IDs for male voices', () => {
        const maleVoices = getMaleVoices();
        
        Object.entries(maleVoices).forEach(([name, id]) => {
          expect(id).to.be.a('string');
          expect(id).to.have.length.greaterThan(10);
          expect(VOICES[name]).to.equal(id);
        });
      });
    });

    describe('getFemaleVoices', () => {
      it('should return only female voices', () => {
        const femaleVoices = getFemaleVoices();
        const expectedFemaleVoices = ['rachel', 'bella', 'elli', 'grace', 'charlotte'];
        
        expect(Object.keys(femaleVoices)).to.have.members(expectedFemaleVoices);
        expect(Object.keys(femaleVoices)).to.have.length(5);
      });

      it('should return valid voice IDs for female voices', () => {
        const femaleVoices = getFemaleVoices();
        
        Object.entries(femaleVoices).forEach(([name, id]) => {
          expect(id).to.be.a('string');
          expect(id).to.have.length.greaterThan(10);
          expect(VOICES[name]).to.equal(id);
        });
      });
    });

    describe('getRandomVoice with gender parameter', () => {
      it('should return male voice when gender is "male"', () => {
        const maleVoiceIds = Object.values(getMaleVoices());
        
        for (let i = 0; i < 10; i++) {
          const voiceId = getRandomVoice('male');
          expect(maleVoiceIds).to.include(voiceId);
        }
      });

      it('should return female voice when gender is "female"', () => {
        const femaleVoiceIds = Object.values(getFemaleVoices());
        
        for (let i = 0; i < 10; i++) {
          const voiceId = getRandomVoice('female');
          expect(femaleVoiceIds).to.include(voiceId);
        }
      });

      it('should return any voice when gender is null or undefined', () => {
        const allVoiceIds = Object.values(VOICES);
        
        const randomVoice1 = getRandomVoice(null);
        const randomVoice2 = getRandomVoice(undefined);
        const randomVoice3 = getRandomVoice();
        
        expect(allVoiceIds).to.include(randomVoice1);
        expect(allVoiceIds).to.include(randomVoice2);
        expect(allVoiceIds).to.include(randomVoice3);
      });
    });

    describe('generateVoiceover with gender parameter', () => {
      let fetchStub;
      let fsStub;
      let processEnvStub;

      beforeEach(() => {
        // Mock fetch
        fetchStub = sinon.stub(global, 'fetch');
        
        // Mock fs
        fsStub = {
          writeFile: sinon.stub(fs, 'writeFile'),
          mkdir: sinon.stub(fs, 'mkdir'),
          stat: sinon.stub(fs, 'stat')
        };
        
        // Mock process.env
        processEnvStub = sinon.stub(process, 'env').value({
          ELEVENLABS_API_KEY: 'test-api-key'
        });

        // Mock successful API response
        fetchStub.resolves({
          ok: true,
          arrayBuffer: sinon.stub().resolves(new ArrayBuffer(2048))
        });

        fsStub.mkdir.resolves();
        fsStub.writeFile.resolves();
        fsStub.stat.resolves({ size: 2048 });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should use male voice when gender is "male"', async () => {
        const text = 'Test text';
        const maleVoiceIds = Object.values(getMaleVoices());
        
        await generateVoiceover(text, undefined, undefined, 'male');
        
        const apiCall = fetchStub.getCall(0);
        const actualUrl = apiCall.args[0];
        const voiceId = actualUrl.split('/').pop();
        
        expect(maleVoiceIds).to.include(voiceId);
      });

      it('should use female voice when gender is "female"', async () => {
        const text = 'Test text';
        const femaleVoiceIds = Object.values(getFemaleVoices());
        
        await generateVoiceover(text, undefined, undefined, 'female');
        
        const apiCall = fetchStub.getCall(0);
        const actualUrl = apiCall.args[0];
        const voiceId = actualUrl.split('/').pop();
        
        expect(femaleVoiceIds).to.include(voiceId);
      });

      it('should throw error for invalid gender parameter', async () => {
        const text = 'Test text';
        
        try {
          await generateVoiceover(text, undefined, undefined, 'invalid');
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).to.include('Gender must be "male", "female", or null');
        }
      });
    });
  });
});