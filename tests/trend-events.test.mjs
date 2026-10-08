import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTrendEvents } from '../app/trend-events.ts';

const trend = {
  activity: {
    points: [{ date: '2026-08-01', value: 100 }, { date: '2026-09-09', value: 120 }],
  },
  events: [{ event_date: '2026-08-20', title: '新赛季上线', summary: '新玩法', source: 'DataBrain', url: 'https://example.com/event' }],
};

test('trend events align to the chart date range and preserve event dates', () => {
  const events = buildTrendEvents({ intelligence: {
    recent_updates: [{ date: '2026-08-25', version: 'v2.0', summary: '版本更新', source: '官方' }],
    recent_articles: [{ date: '2026-08-26', title: '版本更新公告', summary: '活动开启', source: '媒体', url: 'https://example.com/article' }],
  } }, trend);
  assert.deepEqual(events.map((event) => event.date).sort(), ['2026-08-20', '2026-08-25', '2026-08-26']);
  assert.equal(events.find((event) => event.date === '2026-08-20').dateMeaning, '事件日期');
  assert.equal(events.find((event) => event.date === '2026-08-26').dateMeaning, '消息日期');
});

test('non-event analysis articles and out-of-range dates are excluded', () => {
  const events = buildTrendEvents({ intelligence: {
    recent_articles: [
      { date: '2026-07-31', title: '行业分析报告', summary: '版本更新趋势', url: 'https://example.com/old' },
      { date: '2026-08-28', title: '玩家评测', summary: '很好玩', url: 'https://example.com/review' },
    ],
  } }, { ...trend, events: [] });
  assert.equal(events.length, 0);
});

test('duplicate DataBrain annotation and intelligence records render once', () => {
  const events = buildTrendEvents({ intelligence: {
    recent_updates: [{ date: '2026-08-20', title: '新赛季上线', url: 'https://example.com/event' }],
  } }, trend);
  assert.equal(events.filter((event) => event.url === 'https://example.com/event').length, 1);
});

test('fetched DataBrain events take precedence and retain the message date', () => {
  const events = buildTrendEvents({ intelligence: {
    recent_updates: [{ date: '2026-08-20', title: '本地旧记录', source: '本地资料' }],
  } }, { ...trend, events: [] }, [{
    game_name: '金铲铲之战',
    event_date: '2026-08-20',
    published_date: '2026-08-18',
    title: '18.1版本更新及新赛季开启',
    summary: '新赛季上线。',
    source: 'DataBrain Agent · Web Search',
    url: 'https://example.com/databrain-event',
    date_meaning: '赛季/版本上线日期',
  }]);
  const fetched = events.find((event) => event.url === 'https://example.com/databrain-event');
  assert.ok(fetched);
  assert.equal(fetched.date, '2026-08-20');
  assert.equal(fetched.publishedDate, '2026-08-18');
  assert.equal(fetched.dateMeaning, '事件日期');
  assert.equal(events.find((event) => event.date === '2026-08-20').title, '18.1版本更新及新赛季开启');
});
