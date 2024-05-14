import React, { ReactNode } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
    useAnimatedGestureHandler,
    useAnimatedStyle,
    useAnimatedReaction,
    withSpring,
    scrollTo,
    withTiming,
    useSharedValue,
    runOnJS,
    SharedValue,
    AnimatedRef,
} from 'react-native-reanimated';
import {
    PanGestureHandler,
    PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    animationConfig,
    COL,
    getOrder,
    getPosition,
    Positions,
    SIZE,
} from './config';

interface AnimatedWidgetProps {
    children: ReactNode;
    positions: SharedValue<Positions>;
    id: string;
    editing: boolean;
    scrollView: AnimatedRef<Animated.ScrollView>;
    scrollY: SharedValue<number>;
}

export default function AnimatedWidget({
    children,
    positions,
    id,
    scrollView,
    scrollY,
    editing,
}: AnimatedWidgetProps) {
    const inset = useSafeAreaInsets();
    const containerHeight =
        Dimensions.get('window').height - inset.top - inset.bottom;
    const contentHeight = (Object.keys(positions.value).length / COL) * SIZE;
    const isGestureActive = useSharedValue(false);

    const position = getPosition(positions.value[id]!);
    const translateX = useSharedValue(position.x);
    const translateY = useSharedValue(position.y);

    useAnimatedReaction(
        () => positions.value[id]!,
        (newOrder) => {
            if (!isGestureActive.value) {
                const pos = getPosition(newOrder);
                translateX.value = withTiming(pos.x, animationConfig);
                translateY.value = withTiming(pos.y, animationConfig);
            }
        }
    );

    const onGestureEvent = useAnimatedGestureHandler<
        PanGestureHandlerGestureEvent,
        { x: number; y: number }
    >({
        onStart: (_, ctx) => {
            if (editing) {
                ctx.x = translateX.value;
                ctx.y = translateY.value;
                isGestureActive.value = true;
            }
        },
        onActive: ({ translationX, translationY }, ctx) => {
            if (editing) {
                translateX.value = ctx.x + translationX;
                translateY.value = ctx.y + translationY;
                const newOrder = getOrder(
                    translateX.value,
                    translateY.value,
                    Object.keys(positions.value).length - 1
                );

                const oldOlder = positions.value[id];
                if (newOrder !== oldOlder) {
                    const idToSwap = Object.keys(positions.value).find(
                        (key) => positions.value[key] === newOrder
                    );
                    if (idToSwap) {
                        const newPositions = JSON.parse(
                            JSON.stringify(positions.value)
                        );
                        newPositions[id] = newOrder;
                        newPositions[idToSwap] = oldOlder;
                        positions.value = newPositions;
                    }
                }

                const lowerBound = scrollY.value;
                const upperBound = lowerBound + containerHeight - SIZE;
                const maxScroll = contentHeight - containerHeight;
                const leftToScrollDown = maxScroll - scrollY.value;
                if (translateY.value < lowerBound) {
                    const diff = Math.min(
                        lowerBound - translateY.value,
                        lowerBound
                    );
                    scrollY.value -= diff;
                    scrollTo(scrollView, 0, scrollY.value, false);
                    ctx.y -= diff;
                    translateY.value = ctx.y + translationY;
                }
                if (translateY.value > upperBound) {
                    const diff = Math.min(
                        translateY.value - upperBound,
                        leftToScrollDown
                    );
                    scrollY.value += diff;
                    scrollTo(scrollView, 0, scrollY.value, false);
                    ctx.y += diff;
                    translateY.value = ctx.y + translationY;
                }
            }
        },
        onEnd: () => {
            const newPosition = getPosition(positions.value[id]!);
            translateX.value = withTiming(
                newPosition.x,
                animationConfig,
                () => {
                    isGestureActive.value = false;
                }
            );
            translateY.value = withTiming(newPosition.y, animationConfig);
        },
    });
    const style = useAnimatedStyle(() => {
        const zIndex = isGestureActive.value ? 100 : 0;
        const scale = withSpring(isGestureActive.value ? 1.05 : 1);
        return {
            position: 'absolute',
            top: 0,
            left: 0,
            width: SIZE,
            height: SIZE,
            zIndex,
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale },
            ],
        };
    });
    return (
        <Animated.View style={style}>
            <PanGestureHandler
                enabled={editing}
                onGestureEvent={onGestureEvent}
            >
                <Animated.View style={StyleSheet.absoluteFill}>
                    {children}
                </Animated.View>
            </PanGestureHandler>
        </Animated.View>
    );
}
