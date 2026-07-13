import { describe, it, expect } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  // ── agentData ──
  describe('agentData', () => {
    it('should produce stable key arrays for list', () => {
      const key = queryKeys.agentData.list({ page: 1, page_size: 10 });
      expect(key).toEqual(['agent-data', 'list', { page: 1, page_size: 10 }]);
    });

    it('should produce stable key arrays for conversation detail', () => {
      const key = queryKeys.agentData.conversation('session-123');
      expect(key).toEqual(['agent-data', 'conversation', 'session-123']);
    });

    it('all key should be a base prefix', () => {
      expect(queryKeys.agentData.all).toEqual(['agent-data']);
    });
  });

  // ── discussion ──
  describe('discussion', () => {
    it('should produce stable key arrays for sessions', () => {
      const key = queryKeys.discussion.sessions({ page: 1 });
      expect(key).toEqual(['group-discussion', 'sessions', { page: 1 }]);
    });

    it('should produce stable key arrays for messages detail', () => {
      const key = queryKeys.discussion.messages(42);
      expect(key).toEqual(['group-discussion', 'messages', 42]);
    });

    it('publicConfig should have no params', () => {
      const key = queryKeys.discussion.publicConfig();
      expect(key).toEqual(['group-discussion', 'public-config']);
    });

    it('allAgents should have no params', () => {
      const key = queryKeys.discussion.allAgents();
      expect(key).toEqual(['group-discussion', 'all-agents']);
    });
  });

  // ── assessment ──
  describe('assessment', () => {
    it('list should include params', () => {
      const key = queryKeys.assessment.list({ search: 'math' });
      expect(key).toEqual(['assessment-configs', { search: 'math' }]);
    });

    it('detail should include the id parameter', () => {
      const key = queryKeys.assessment.detail(7);
      expect(key).toEqual(['assessment-configs', 'detail', 7]);
    });

    it('editor should include the id parameter', () => {
      const key = queryKeys.assessment.editor(7);
      expect(key).toEqual(['assessment-configs', 'editor', 7]);
    });
  });

  // ── assessmentQuestions ──
  describe('assessmentQuestions', () => {
    it('list should include configId and params', () => {
      const key = queryKeys.assessmentQuestions.list(1, { skip: 0, limit: 10 });
      expect(key).toEqual(['assessment-questions', 1, { skip: 0, limit: 10 }]);
    });

    it('adaptive should include configId', () => {
      const key = queryKeys.assessmentQuestions.adaptive(3);
      expect(key).toEqual(['assessment-questions', 3, 'adaptive']);
    });
  });

  // ── assessmentStats ──
  describe('assessmentStats', () => {
    it('statistics includes configId and optional params', () => {
      const key = queryKeys.assessmentStats.statistics(1);
      expect(key).toEqual(['assessment-statistics', 1, 'statistics', undefined]);
    });

    it('sessions includes configId and params', () => {
      const key = queryKeys.assessmentStats.sessions(1, { class_name: 'A班' });
      expect(key).toEqual(['assessment-statistics', 1, 'sessions', { class_name: 'A班' }]);
    });

    it('classNames includes configId', () => {
      const key = queryKeys.assessmentStats.classNames(2);
      expect(key).toEqual(['assessment-statistics', 2, 'classNames']);
    });

    it('sessionDetail accepts nullable id', () => {
      const key = queryKeys.assessmentStats.sessionDetail(null);
      expect(key).toEqual(['assessment-statistics', 'sessionDetail', null]);
    });

    it('studentProfile includes configId to avoid cross-assessment profile cache reuse', () => {
      const key = queryKeys.assessmentStats.studentProfile(12, 34, 56);
      expect(key).toEqual(['assessment-statistics', 'studentProfile', 56, 12, 34]);
    });
  });

  // ── aiAgents ──
  describe('aiAgents', () => {
    it('list should include params', () => {
      const key = queryKeys.aiAgents.list({ agent_type: 'teacher' });
      expect(key).toEqual(['ai-agents', { agent_type: 'teacher' }]);
    });

    it('statistics should have no params', () => {
      const key = queryKeys.aiAgents.statistics();
      expect(key).toEqual(['ai-agents', 'statistics']);
    });
  });

  // ── articles ──
  describe('articles', () => {
    it('list should include params', () => {
      const key = queryKeys.articles.list({ category: 'news' });
      expect(key).toEqual(['articles', { category: 'news' }]);
    });
  });

  // ── classroomPlans ──
  describe('classroomPlans', () => {
    it('detail should include the id parameter', () => {
      const key = queryKeys.classroomPlans.detail(10);
      expect(key).toEqual(['classroom-plans', 'detail', 10]);
    });
  });

  // ── classroom ──
  describe('classroom', () => {
    it('detail should accept nullable id', () => {
      const key = queryKeys.classroom.detail(null);
      expect(key).toEqual(['classroom-activities', 'detail', null]);
    });
  });

  // ── users ──
  describe('users', () => {
    it('list should include params', () => {
      const key = queryKeys.users.list({ role: 'student' });
      expect(key).toEqual(['users', { role: 'student' }]);
    });

    it('all key should be stable', () => {
      expect(queryKeys.users.all).toEqual(['users']);
    });
  });

  // ── activeAgents ──
  describe('activeAgents', () => {
    it('all key should be stable', () => {
      expect(queryKeys.activeAgents.all).toEqual(['active-agents']);
    });
  });

  describe('itGames', () => {
    it('keeps public, admin and log caches in one namespace', () => {
      expect(queryKeys.itGames.list({ page: 1 })).toEqual(['it-games', 'list', { page: 1 }]);
      expect(queryKeys.itGames.adminList({ page: 1 })).toEqual(['it-games', 'admin-list', { page: 1 }]);
      expect(queryKeys.itGames.logs(7, 1, 50)).toEqual(['it-games', 'logs', 7, 1, 50]);
    });
  });
});
