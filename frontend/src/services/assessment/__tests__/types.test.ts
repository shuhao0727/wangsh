import { describe, it, expect } from 'vitest';

describe('assessment service exports', () => {
  it('should export assessmentConfigApi with expected methods', async () => {
    const { assessmentConfigApi } = await import('../config');
    expect(assessmentConfigApi).toBeDefined();
    expect(typeof assessmentConfigApi.list).toBe('function');
    expect(typeof assessmentConfigApi.get).toBe('function');
    expect(typeof assessmentConfigApi.create).toBe('function');
    expect(typeof assessmentConfigApi.update).toBe('function');
    expect(typeof assessmentConfigApi.delete).toBe('function');
    expect(typeof assessmentConfigApi.toggle).toBe('function');
  });

  it('should export assessmentQuestionApi with expected methods', async () => {
    const { assessmentQuestionApi } = await import('../question');
    expect(assessmentQuestionApi).toBeDefined();
    expect(typeof assessmentQuestionApi.list).toBe('function');
    expect(typeof assessmentQuestionApi.create).toBe('function');
    expect(typeof assessmentQuestionApi.update).toBe('function');
    expect(typeof assessmentQuestionApi.delete).toBe('function');
    expect(typeof assessmentQuestionApi.generate).toBe('function');
  });

  it('should export assessmentSessionApi with expected methods', async () => {
    const { assessmentSessionApi } = await import('../session');
    expect(assessmentSessionApi).toBeDefined();
    // Student endpoints
    expect(typeof assessmentSessionApi.available).toBe('function');
    expect(typeof assessmentSessionApi.start).toBe('function');
    expect(typeof assessmentSessionApi.getQuestions).toBe('function');
    expect(typeof assessmentSessionApi.submitAnswer).toBe('function');
    expect(typeof assessmentSessionApi.submit).toBe('function');
    expect(typeof assessmentSessionApi.getResult).toBe('function');
    expect(typeof assessmentSessionApi.getBasicProfile).toBe('function');
    // Admin endpoints
    expect(typeof assessmentSessionApi.getClassNames).toBe('function');
    expect(typeof assessmentSessionApi.getConfigSessions).toBe('function');
    expect(typeof assessmentSessionApi.getSessionDetail).toBe('function');
    expect(typeof assessmentSessionApi.getStatistics).toBe('function');
  });

  it('should export profileApi with expected methods', async () => {
    const { profileApi } = await import('../profile');
    expect(profileApi).toBeDefined();
    expect(typeof profileApi.generate).toBe('function');
    expect(typeof profileApi.batchGenerate).toBe('function');
    expect(typeof profileApi.list).toBe('function');
    expect(typeof profileApi.get).toBe('function');
    expect(typeof profileApi.delete).toBe('function');
    expect(typeof profileApi.getMyProfiles).toBe('function');
    expect(typeof profileApi.getMyProfile).toBe('function');
  });

  it('should re-export all APIs from index barrel', async () => {
    const mod = await import('../index');
    expect(mod.assessmentConfigApi).toBeDefined();
    expect(mod.assessmentQuestionApi).toBeDefined();
    expect(mod.assessmentSessionApi).toBeDefined();
    expect(mod.profileApi).toBeDefined();
  });
});
