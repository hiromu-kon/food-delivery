import type { LucideIcon, LucideProps } from 'lucide-react-native';
import * as React from 'react';
import { withUniwind } from 'uniwind';

import { cn } from '../cn';
import { TextClassContext } from './text';

type IconProps = LucideProps & {
  as: LucideIcon;
};

function IconImpl({ as: IconComponent, ...props }: IconProps) {
  return <IconComponent {...props} />;
}

// lucide の部品は className を解釈しないため、大きさと色を className から props に移す
const StyledIcon = withUniwind(IconImpl, {
  size: { fromClassName: 'className', styleProperty: 'width' },
  color: { fromClassName: 'className', styleProperty: 'color' },
});

function Icon({ as, className, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  return (
    <StyledIcon as={as} className={cn('text-primary size-5', textClass, className)} {...props} />
  );
}

export { Icon };
