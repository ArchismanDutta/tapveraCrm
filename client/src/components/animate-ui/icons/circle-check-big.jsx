'use client';;
import * as React from 'react';
import { motion } from 'motion/react';

import { getVariants, useAnimateIconContext, IconWrapper } from '@/components/animate-ui/icons/icon';

const animations = {
  default: {
    path1: {},

    path2: {
      initial: {
        pathLength: 1,
        opacity: 1,
        scale: 1,
      },
      animate: {
        pathLength: [0, 1],
        opacity: [0, 1],
        scale: [1, 1.1, 1],
        transition: {
          duration: 0.6,
          ease: 'easeInOut',
        },
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
      <motion.path
        d="M21.801 10A10 10 0 1 1 17 3.335"
        variants={variants.path1}
        initial="initial"
        animate={controls} />
      <motion.path
        d="m9 11 3 3L22 4"
        variants={variants.path2}
        initial="initial"
        animate={controls} />
    </motion.svg>
  );
}

function CircleCheckBig(props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, CircleCheckBig, CircleCheckBig as CircleCheckBigIcon };
