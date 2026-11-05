import type { IconComponent, IconProps } from 'reicon-react/createIcon';
import type { AgentState } from '@agent-office/shared';
import type { ActivityKind } from '../live/activityKind';
import { AnglesLeft } from 'reicon-react/icons/AnglesLeft';
import { Moon } from 'reicon-react/icons/Moon';
import { Sun } from 'reicon-react/icons/Sun';
import { Hand } from 'reicon-react/icons/Hand';
import { Flash } from 'reicon-react/icons/Flash';
import { Coffee } from 'reicon-react/icons/Coffee';
import { Bonfire } from 'reicon-react/icons/Bonfire';
import { BookOpen } from 'reicon-react/icons/BookOpen';
import { CloseCircle } from 'reicon-react/icons/CloseCircle';
import { Cpu } from 'reicon-react/icons/Cpu';
import { Desktop } from 'reicon-react/icons/Desktop';
import { Folder } from 'reicon-react/icons/Folder';
import { Hashtag } from 'reicon-react/icons/Hashtag';
import { History } from 'reicon-react/icons/History';
import { Hourglass } from 'reicon-react/icons/Hourglass';
import { LaptopCode } from 'reicon-react/icons/LaptopCode';
import { Layers } from 'reicon-react/icons/Layers';
import { ListCheck } from 'reicon-react/icons/ListCheck';
import { MessageText } from 'reicon-react/icons/MessageText';
import { MoonSleep } from 'reicon-react/icons/MoonSleep';
import { PenWriting } from 'reicon-react/icons/PenWriting';
import { PlayCircle } from 'reicon-react/icons/PlayCircle';
import { Pulse } from 'reicon-react/icons/Pulse';
import { SearchNormal } from 'reicon-react/icons/SearchNormal';
import { ShieldAlert } from 'reicon-react/icons/ShieldAlert';
import { Timer } from 'reicon-react/icons/Timer';
import { Tshirt } from 'reicon-react/icons/Tshirt';
import { Users } from 'reicon-react/icons/Users';
import { Bell } from 'reicon-react/icons/Bell';
import { Check } from 'reicon-react/icons/Check';
import { CodeSquare } from 'reicon-react/icons/CodeSquare';
import { Copy } from 'reicon-react/icons/Copy';
import { TerminalSquare } from 'reicon-react/icons/TerminalSquare';
import { TickCircle } from 'reicon-react/icons/TickCircle';
import { VolumeHigh } from 'reicon-react/icons/VolumeHigh';
import { Xmark } from 'reicon-react/icons/Xmark';

/*
 * The app's icons, all from Reicon (https://reicon.dev) in its Filled weight, so every
 * screen uses one consistent set. They are decorative: the button around each one carries
 * the accessible name.
 */

function filled(Icon: IconComponent, name: string) {
  function FilledIcon({ size = 16, ...props }: IconProps) {
    return <Icon weight="Filled" size={size} aria-hidden focusable="false" {...props} />;
  }
  FilledIcon.displayName = name;
  return FilledIcon;
}

/** Points left; rotate it for "expand" on a left panel. */
export const CollapseIcon = filled(AnglesLeft, 'CollapseIcon');
export const CloseIcon = filled(Xmark, 'CloseIcon');
export const CopyIcon = filled(Copy, 'CopyIcon');
export const CopiedIcon = filled(Check, 'CopiedIcon');
export const EditorIcon = filled(CodeSquare, 'EditorIcon');
export const TerminalIcon = filled(TerminalSquare, 'TerminalIcon');
export const FinishedIcon = filled(TickCircle, 'FinishedIcon');
export const SoundIcon = filled(VolumeHigh, 'SoundIcon');
export const LightModeIcon = filled(Sun, 'LightModeIcon');
export const DarkModeIcon = filled(Moon, 'DarkModeIcon');
export const AlertsIcon = filled(Bell, 'AlertsIcon');

/* Tabs: how characters look. */
export const TaskModeIcon = filled(ListCheck, 'TaskModeIcon');
export const DeskModeIcon = filled(Desktop, 'DeskModeIcon');

/* The two halves of the office. */
export const CampIcon = filled(Bonfire, 'CampIcon');
export const WorkIcon = filled(LaptopCode, 'WorkIcon');

/* Agent details. */
export const AgentIcon = filled(Cpu, 'AgentIcon');
export const DeskIcon = filled(Desktop, 'DeskIcon');
export const FolderIcon = filled(Folder, 'FolderIcon');
export const SessionIcon = filled(Hashtag, 'SessionIcon');
export const WaitingIcon = filled(Hourglass, 'WaitingIcon');
export const TimerIcon = filled(Timer, 'TimerIcon');
export const LastEventIcon = filled(History, 'LastEventIcon');
export const ActivityIcon = filled(Pulse, 'ActivityIcon');
export const CostumeIcon = filled(Tshirt, 'CostumeIcon');

/* One per kind of activity line. */
export const PromptIcon = filled(MessageText, 'PromptIcon');
export const ReadIcon = filled(BookOpen, 'ReadIcon');
export const SearchIcon = filled(SearchNormal, 'SearchIcon');
export const EditIcon = filled(PenWriting, 'EditIcon');
export const PermissionIcon = filled(ShieldAlert, 'PermissionIcon');
export const SubagentIcon = filled(Users, 'SubagentIcon');
export const StartIcon = filled(PlayCircle, 'StartIcon');
export const ContextIcon = filled(Layers, 'ContextIcon');
export const SleepIcon = filled(MoonSleep, 'SleepIcon');
export const FailedIcon = filled(CloseCircle, 'FailedIcon');

export const ACTIVITY_ICON: Readonly<
  Record<ActivityKind, (props: IconProps) => React.JSX.Element>
> = {
  prompt: PromptIcon,
  read: ReadIcon,
  search: SearchIcon,
  terminal: TerminalIcon,
  edit: EditIcon,
  permission: PermissionIcon,
  subagent: SubagentIcon,
  finished: FinishedIcon,
  start: StartIcon,
  context: ContextIcon,
  sleep: SleepIcon,
  failed: FailedIcon,
  other: ActivityIcon,
};

/* One per agent state, shown after its color dot. */
export const IdleIcon = filled(Coffee, 'IdleIcon');
export const CalledIcon = filled(Flash, 'CalledIcon');
export const NeedsYouIcon = filled(Hand, 'NeedsYouIcon');

export const STATE_ICON: Readonly<Record<AgentState, (props: IconProps) => React.JSX.Element>> = {
  idle: IdleIcon,
  called: CalledIcon,
  working: EditIcon,
  reading: ReadIcon,
  running: TerminalIcon,
  'needs-you': NeedsYouIcon,
  done: FinishedIcon,
  stale: SleepIcon,
};
