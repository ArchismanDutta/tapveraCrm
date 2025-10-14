'use client';;
import * as React from 'react';
import { motion } from 'motion/react';

import { getVariants, useAnimateIconContext, IconWrapper } from '@/components/animate-ui/icons/icon';

const animations = {
  default: {
    circle: {},

    line1: {
      initial: {
        rotate: 0,
        transition: { ease: 'easeInOut', duration: 0.6 },
      },
      animate: {
        transformOrigin: 'bottom right',
        rotate: [0, 20, 0],
        transition: { ease: 'easeInOut', duration: 0.6 },
      },
    },

    line2: {
      initial: {
        rotate: 0,
        transition: { ease: 'easeInOut', duration: 0.6 },
      },
      animate: {
        transformOrigin: 'bottom left',
        rotate: 360,
        transition: { ease: 'easeInOut', duration: 0.6 },
      },
    }
  }
};

function IconComponent({
  size,
  ...props
}) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}>
      <motion.circle
        cx={12}
        cy={12}
        r={10}
        variants={variants.circle}
        initial="initial"
        animate={controls} />
      <motion.line
        x1={8}
        y1={10}
        x2={12}
        y2={12}
        variants={variants.line1}
        initial="initial"
        animate={controls} />
      <motion.line
        x1={12}
        y1={6}
        x2={12}
        y2={12}
        variants={variants.line2}
        initial="initial"
        animate={controls} />
    </motion.svg>
  );
}

function Clock10(props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, Clock10, Clock10 as Clock10Icon };
