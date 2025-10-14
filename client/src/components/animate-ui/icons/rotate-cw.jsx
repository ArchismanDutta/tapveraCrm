'use client';;
import * as React from 'react';
import { motion } from 'motion/react';

import { getVariants, useAnimateIconContext, IconWrapper } from '@/components/animate-ui/icons/icon';

const animations = {
  default: {
    group: {
      initial: {
        rotate: 0,
        transition: { type: 'spring', stiffness: 150, damping: 25 },
      },
      animate: {
        rotate: 45,
        transition: { type: 'spring', stiffness: 150, damping: 25 },
      },
    },

    path1: {},
    path2: {}
  },

  rotate: {
    group: {
      initial: {
        rotate: 0,
        transition: { type: 'spring', stiffness: 100, damping: 25 },
      },
      animate: {
        rotate: 360,
        transition: { type: 'spring', stiffness: 100, damping: 25 },
      },
    },

    path1: {},
    path2: {}
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
      variants={variants.group}
      initial="initial"
      animate={controls}
      {...props}>
      <motion.path
        d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
        variants={variants.path1}
        initial="initial"
        animate={controls} />
      <motion.path
        d="M21 3v5h-5"
        variants={variants.path2}
        initial="initial"
        animate={controls} />
    </motion.svg>
  );
}

function RotateCw(props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, RotateCw, RotateCw as RotateCwIcon };
