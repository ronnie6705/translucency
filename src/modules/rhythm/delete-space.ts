import type { RhythmLibrary } from './library';
import type { Space } from './types';

export function spaceContents(data: RhythmLibrary, id: string) {
  const space = data.spaces?.find(space => space.id === id);
  if (!space) throw new Error('This space no longer exists.');
  const lists = data.taskLists.filter(list => list.spaceId === id);
  return { taskCount: space.tasks.length + lists.reduce((total, list) => total + list.tasks.length, 0), listCount: lists.length,
    fingerprint: JSON.stringify([space.tasks, lists]) };
}

type DeleteSpaceOptions = { mode: 'move'; destinationId?: string; newSpace?: Space }
  | { mode: 'delete'; expectedContents: string };

/** One library transaction; accepted schedules and execution history are snapshots. */
export function deleteSpace(data: RhythmLibrary, id: string, options: DeleteSpaceOptions): RhythmLibrary {
  const contents = spaceContents(data, id);
  const source = data.spaces!.find(space => space.id === id)!;
  let spaces = data.spaces!.filter(space => space.id !== id);
  let taskLists = data.taskLists;
  if (options.mode === 'delete') {
    if (contents.fingerprint !== options.expectedContents) throw new Error('This space changed while you were reviewing it. Close this confirmation and review its contents again.');
    taskLists = taskLists.filter(list => list.spaceId !== id);
  } else if (contents.taskCount || contents.listCount) {
    let destination = spaces.find(space => space.id === options.destinationId);
    if (!destination && options.newSpace) {
      if (options.newSpace.id === id || spaces.some(space => space.id === options.newSpace!.id)) throw new Error('Choose another destination space.');
      destination = {...options.newSpace, tasks: []};
      spaces = [...spaces, destination];
    }
    if (!destination) throw new Error('Choose an existing destination space.');
    const destinationId = destination.id;
    if (source.tasks.some(task => destination.tasks.some(existing => existing.id === task.id))) throw new Error('The destination already contains one of these tasks. Choose another space.');
    spaces = spaces.map(space => space.id === destinationId ? {...space, tasks:[...space.tasks, ...source.tasks]} : space);
    taskLists = taskLists.map(list => list.spaceId === id ? {...list, spaceId: destinationId} : list);
  }
  return {...data, spaces, taskLists};
}
