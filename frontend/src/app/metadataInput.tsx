import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Cross1Icon, InfoCircledIcon } from '@radix-ui/react-icons';
import { MetadataFieldComponent } from './utils';

export function MetadataInput({
  field,
  value,
  span,
  onValueChange,
  canCancel = false,
  onCancel = () => {},
}: {
  field: MetadataFieldComponent;
  value: unknown;
  span: number;
  onValueChange: (value: unknown) => void;
  canCancel?: boolean;
  onCancel?: () => void;
}) {
  // comment for tailwind, col-span-1 col-span-2 col-span-3
  // col-span-4 col-span-5 col-span-10 col-span-11 col-span-12
  const className = `h-fit col-span-${span}`;

  const isConflicted =
    value && typeof value === 'object' && 'conflict' in value
      ? value.conflict
      : false;

  if (isConflicted) {
    value = null;
  }

  const updateValue = (value: any) => {
    if (field.type === 'select') {
      if (value === 'REMOVE') {
        return onValueChange(null);
      } else {
        return onValueChange(value);
      }
    } else if (field.type === 'number') {
      if (value === '' || value === undefined || value === null) {
        return onValueChange(null);
      } else {
        const num = parseInt(value, 10);
        if (isNaN(num)) {
          return onValueChange(null);
        } else {
          return onValueChange(value);
        }
      }
    } else {
      if (value === '' || value === undefined || value === null) {
        return onValueChange(null);
      } else {
        return onValueChange(value);
      }
    }
  };

  if (field.type === 'select') {
    return (
      <div className={className}>
        <div className={'flex mb-1'}>
          <Label>{field.label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <InfoCircledIcon className="ml-1" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{field.help}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select value={(value as string) || ''} onValueChange={updateValue}>
          <SelectTrigger>
            <SelectValue placeholder={'Select'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={'REMOVE'}>
              <i>Remove</i>
            </SelectItem>
            {Object.keys(field.enum).map((val) => {
              const label = (field.enum as any)[val];
              return <SelectItem value={val}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className={className}>
        <div className={'flex mb-1'}>
          <Label>{field.label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <InfoCircledIcon className="ml-1" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{field.help}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center">
          <Input
            className="flex-grow"
            type="number"
            value={value as number}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(event) => {
              updateValue(event.target.value);
            }}
          />
          {canCancel ? (
            <div className="ml-2 cursor-pointer" onClick={onCancel}>
              <Cross1Icon></Cross1Icon>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (field.multiline) {
    return (
      <div className={className}>
        <div className={'flex mb-1'}>
          <Label>{field.label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <InfoCircledIcon className="ml-1" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{field.help}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center">
          <Textarea
            className="flex-grow"
            value={value as string}
            onChange={(event) => {
              updateValue(event.target.value);
            }}
          />
          {canCancel ? (
            <div className="ml-2 cursor-pointer" onClick={onCancel}>
              <Cross1Icon></Cross1Icon>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={'flex mb-1'}>
        <Label>{field.label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <InfoCircledIcon className="ml-1" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{field.help}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center">
        <Input
          className="flex-grow"
          placeholder={isConflicted ? 'Conflicting Values' : ''}
          value={value as string}
          onChange={(event) => {
            updateValue(event.target.value);
          }}
        />
        {canCancel ? (
          <div className="ml-2 cursor-pointer" onClick={onCancel}>
            <Cross1Icon></Cross1Icon>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default MetadataInput;
