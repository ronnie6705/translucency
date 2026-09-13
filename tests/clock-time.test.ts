import test from 'node:test';
import assert from 'node:assert/strict';
import { clockTimeToMinutes, clockTimeToString, parseClockTime, snapClockAngle, TIME_RANGE_PRESETS, radialInfluence, rangeArc } from '../src/modules/rhythm/clock-time';
import { validateTimeblockPlan } from '../src/modules/rhythm/timeblock-plan';

test('clock conversion handles noon, midnight and all five-minute values without drift', () => {
  assert.equal(clockTimeToMinutes({ hour: 12, minute: 0, period: 'AM' }), 0);
  assert.equal(clockTimeToMinutes({ hour: 12, minute: 0, period: 'PM' }), 720);
  assert.equal(clockTimeToMinutes({ hour: 1, minute: 0, period: 'PM' }), 780);
  for (let minutes = 0; minutes < 1440; minutes += 5) {
    const value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const clock = parseClockTime(value)!;
    assert.equal(clockTimeToMinutes(clock), minutes);
    assert.equal(clockTimeToString(clock), value);
  }
  for (const value of ['', '24:00', '12:07', '09:18', '12:37', '00:52', '9:00 AM']) assert.equal(parseClockTime(value), undefined);
});

test('clock dragging snaps each ring independently, including the boundary around twelve', () => {
  assert.equal(snapClockAngle(0, -100, 12), 0);
  assert.equal(snapClockAngle(-1, -100, 12), 0);
  assert.equal(snapClockAngle(100, 0, 12), 3);
  assert.equal(snapClockAngle(95, 12, 12), 3);
  assert.equal(snapClockAngle(0, 100, 12), 6);
  assert.equal(snapClockAngle(-100, 0, 12), 9);
  for (let index = 0; index < 12; index++) {
    for (const radius of [0.1, 5, 100, 1000]) {
      const angle = index * Math.PI / 6;
      assert.equal(snapClockAngle(Math.sin(angle) * radius, -Math.cos(angle) * radius, 12), index);
    }
  }
});

test('presets are valid same-day windows; PM-to-AM and equal endpoints stay invalid', () => {
  for (const preset of TIME_RANGE_PRESETS) assert.equal(validateTimeblockPlan([], preset.start, preset.end).validRange, true);
  assert.equal(validateTimeblockPlan([], '09:05', '17:55').validRange, true);
  assert.equal(validateTimeblockPlan([], '17:00', '09:00').validRange, false);
  assert.equal(validateTimeblockPlan([], '12:00', '12:00').validRange, false);
});


test('radial lift is continuous, symmetric, and wraps around midnight', () => {
  assert.equal(radialInfluence(0, 0), 1);
  assert.equal(radialInfluence(0, 359), radialInfluence(0, 1));
  assert.equal(radialInfluence(60, 75), radialInfluence(90, 75));
  assert.ok(radialInfluence(30, 0) > .6 && radialInfluence(30, 0) < .7);
  assert.ok(radialInfluence(60, 0) > .15 && radialInfluence(60, 0) < .3);
  assert.ok(radialInfluence(180, 0) < .001);
});

test('completed arcs represent a full 24-hour day without confusing long and short windows', () => {
  const arc = (start: string, end: string) => rangeArc(parseClockTime(start)!, parseClockTime(end)!);
  assert.deepEqual(arc('09:15', '17:30'), { startAngle: 138.75, sweepAngle: 123.75, duration: 495 });
  assert.equal(arc('01:00', '21:00')!.sweepAngle, 300);
  assert.equal(arc('00:00', '23:55')!.duration, 1435);
  assert.equal(arc('17:00', '09:00'), undefined);
  assert.equal(arc('12:00', '12:00'), undefined);
});
