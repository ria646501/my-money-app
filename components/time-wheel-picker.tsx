import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandColors } from '@/constants/theme';
import { Period, TimeSelection } from '@/lib/expense-record';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEM_COUNT = 3;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEM_COUNT;
const CYCLIC_REPEAT_COUNT = 9;
const MIDDLE_REPEAT_INDEX = Math.floor(CYCLIC_REPEAT_COUNT / 2);
const RECENTER_REPEAT_THRESHOLD = 2;
const DRAG_END_SETTLE_DELAY = 120;
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const PERIODS: Period[] = ['AM', 'PM'];

type WheelColumnProps<T extends string | number> = {
  accessibilityLabel: string;
  columnId: string;
  items: readonly T[];
  selectedValue: T;
  formatValue: (value: T) => string;
  onChange: (value: T) => void;
  onInteractionStart: (columnId: string, stop: () => void) => void;
  width: number;
  cyclic?: boolean;
};

const WheelItem = memo(
  forwardRef<
    Text,
    { accessibilityLabel: string; isSelected: boolean; onPress: () => void; text: string }
  >(function WheelItem(
    { accessibilityLabel, isSelected, onPress, text },
    ref
  ) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        onPress={onPress}
        style={styles.item}>
        <Text ref={ref} style={isSelected ? styles.itemTextSelected : styles.itemText}>
          {text}
        </Text>
      </Pressable>
    );
  })
);

function WheelColumn<T extends string | number>({
  accessibilityLabel,
  columnId,
  items,
  selectedValue,
  formatValue,
  onChange,
  onInteractionStart,
  width,
  cyclic = false,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitializedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isMomentumScrollingRef = useRef(false);
  const ignoreNextMomentumEndRef = useRef(false);
  const tappedIndexRef = useRef<number | null>(null);
  const itemRefs = useRef<(Text | null)[]>([]);
  const lastOffsetRef = useRef(0);
  const lastCommittedValueRef = useRef(selectedValue);
  const displayItems = useMemo(
    () =>
      cyclic
        ? Array.from(
            { length: items.length * CYCLIC_REPEAT_COUNT },
            (_, index) => items[index % items.length]
          )
        : [...items],
    [cyclic, items]
  );
  const baseSelectedIndex = Math.max(0, items.indexOf(selectedValue));
  const middleSelectedIndex = cyclic
    ? MIDDLE_REPEAT_INDEX * items.length + baseSelectedIndex
    : baseSelectedIndex;
  const visualSelectedIndexRef = useRef(middleSelectedIndex);

  const cancelDragEndTimer = () => {
    if (dragEndTimerRef.current !== null) {
      clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
    }
  };

  const applyVisualSelection = (nextIndex: number) => {
    const previousIndex = visualSelectedIndexRef.current;

    if (nextIndex === previousIndex) {
      return;
    }

    itemRefs.current[previousIndex]?.setNativeProps({ style: styles.itemText });
    itemRefs.current[nextIndex]?.setNativeProps({ style: styles.itemTextSelected });
    visualSelectedIndexRef.current = nextIndex;
  };

  useEffect(() => {
    if (
      hasInitializedRef.current &&
      selectedValue === lastCommittedValueRef.current
    ) {
      return;
    }

    hasInitializedRef.current = true;
    lastCommittedValueRef.current = selectedValue;
    applyVisualSelection(middleSelectedIndex);
    lastOffsetRef.current = middleSelectedIndex * ITEM_HEIGHT;

    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: middleSelectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [middleSelectedIndex, selectedValue]);

  useEffect(
    () => () => {
      if (dragEndTimerRef.current !== null) {
        cancelDragEndTimer();
      }
    },
    []
  );

  const getClosestIndex = (offsetY: number) =>
    Math.max(
      0,
      Math.min(displayItems.length - 1, Math.round(offsetY / ITEM_HEIGHT))
    );

  const commitValue = (nextValue: T) => {
    if (nextValue === lastCommittedValueRef.current) {
      return;
    }

    lastCommittedValueRef.current = nextValue;
    onChange(nextValue);
  };

  const scheduleFinalizeAfterScrollSettles = () => {
    cancelDragEndTimer();

    dragEndTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current && !isMomentumScrollingRef.current) {
        finalizeSelection(lastOffsetRef.current);
      }
      dragEndTimerRef.current = null;
    }, DRAG_END_SETTLE_DELAY);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const nextVisualIndex = getClosestIndex(offsetY);

    lastOffsetRef.current = offsetY;

    applyVisualSelection(nextVisualIndex);

    if (
      dragEndTimerRef.current !== null &&
      !isDraggingRef.current &&
      !isMomentumScrollingRef.current
    ) {
      scheduleFinalizeAfterScrollSettles();
    }
  };

  const finalizeSelection = (offsetY: number) => {
    const finalIndex = getClosestIndex(offsetY);
    const nextValue = displayItems[finalIndex];
    const isNearRepeatedEdge =
      cyclic &&
      (finalIndex < items.length * RECENTER_REPEAT_THRESHOLD ||
        finalIndex >=
          displayItems.length - items.length * RECENTER_REPEAT_THRESHOLD);
    const nextOffset = isNearRepeatedEdge
      ? (MIDDLE_REPEAT_INDEX * items.length + items.indexOf(nextValue)) * ITEM_HEIGHT
      : finalIndex * ITEM_HEIGHT;
    const nextVisualIndex = Math.round(nextOffset / ITEM_HEIGHT);

    lastOffsetRef.current = nextOffset;
    applyVisualSelection(nextVisualIndex);

    if (isNearRepeatedEdge || Math.abs(offsetY - nextOffset) > 0.5) {
      scrollRef.current?.scrollTo({ y: nextOffset, animated: false });
    }

    commitValue(nextValue);
  };

  const stopOngoingInteraction = () => {
    const shouldStop =
      isDraggingRef.current ||
      isMomentumScrollingRef.current ||
      tappedIndexRef.current !== null ||
      dragEndTimerRef.current !== null;

    if (!shouldStop) {
      return;
    }

    ignoreNextMomentumEndRef.current =
      isMomentumScrollingRef.current || tappedIndexRef.current !== null;
    isDraggingRef.current = false;
    isMomentumScrollingRef.current = false;
    tappedIndexRef.current = null;
    cancelDragEndTimer();
    finalizeSelection(lastOffsetRef.current);
  };

  const handleTouchStart = () => {
    onInteractionStart(columnId, stopOngoingInteraction);
  };

  const handleItemPress = (index: number) => {
    const nextValue = displayItems[index];

    if (nextValue === undefined) {
      return;
    }

    cancelDragEndTimer();
    tappedIndexRef.current = index;
    commitValue(nextValue);
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
  };

  const handleDragBegin = () => {
    ignoreNextMomentumEndRef.current = false;
    tappedIndexRef.current = null;
    isDraggingRef.current = true;
    isMomentumScrollingRef.current = false;
    cancelDragEndTimer();
  };

  const handleMomentumBegin = () => {
    isDraggingRef.current = false;
    isMomentumScrollingRef.current = true;
    cancelDragEndTimer();
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isMomentumScrollingRef.current = false;
    cancelDragEndTimer();

    if (ignoreNextMomentumEndRef.current) {
      ignoreNextMomentumEndRef.current = false;
      tappedIndexRef.current = null;
      return;
    }

    const tappedIndex = tappedIndexRef.current;
    tappedIndexRef.current = null;
    finalizeSelection(
      tappedIndex === null ? event.nativeEvent.contentOffset.y : tappedIndex * ITEM_HEIGHT
    );
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    scheduleFinalizeAfterScrollSettles();
  };

  return (
    <View style={[styles.column, { width }]}>
      <ScrollView
        accessibilityLabel={accessibilityLabel}
        bounces={false}
        contentContainerStyle={styles.columnContent}
        decelerationRate={cyclic ? 0.994 : 'fast'}
        disableIntervalMomentum={false}
        nestedScrollEnabled
        onMomentumScrollBegin={handleMomentumBegin}
        onMomentumScrollEnd={handleMomentumEnd}
        onMoveShouldSetResponderCapture={() => true}
        onResponderTerminationRequest={() => false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleDragBegin}
        onScrollEndDrag={handleDragEnd}
        onTouchStart={handleTouchStart}
        ref={scrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={ITEM_HEIGHT}>
        {displayItems.map((item, index) => {
          const isSelected = index === middleSelectedIndex;
          const text = formatValue(item);

          return (
            <WheelItem
              accessibilityLabel={`${accessibilityLabel} ${text}`}
              isSelected={isSelected}
              key={`${String(item)}-${index}`}
              onPress={() => handleItemPress(index)}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              text={text}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

type TimeWheelPickerProps = {
  value: TimeSelection;
  onChange: (value: TimeSelection) => void;
  onGestureActiveChange?: (isActive: boolean) => void;
  accentColor?: string;
  highlightColor?: string;
};

export function TimeWheelPicker({
  value,
  onChange,
  onGestureActiveChange,
  accentColor = BrandColors.primary,
  highlightColor = BrandColors.primarySoft,
}: TimeWheelPickerProps) {
  const activeColumnRef = useRef<{ columnId: string; stop: () => void } | null>(null);
  const isGestureActiveRef = useRef(false);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const handleInteractionStart = (columnId: string, stop: () => void) => {
    const activeColumn = activeColumnRef.current;

    if (activeColumn !== null && activeColumn.columnId !== columnId) {
      activeColumn.stop();
    }

    activeColumnRef.current = { columnId, stop };
  };

  const updateValue = (nextValue: Partial<TimeSelection>) => {
    const updatedValue = { ...latestValueRef.current, ...nextValue };
    latestValueRef.current = updatedValue;
    onChange(updatedValue);
  };

  const handlePickerTouchStart = () => {
    if (!isGestureActiveRef.current) {
      isGestureActiveRef.current = true;
      onGestureActiveChange?.(true);
    }
  };

  const handlePickerTouchEnd = () => {
    if (isGestureActiveRef.current) {
      isGestureActiveRef.current = false;
      onGestureActiveChange?.(false);
    }
  };

  return (
    <View
      onTouchCancel={handlePickerTouchEnd}
      onTouchEnd={handlePickerTouchEnd}
      onTouchStart={handlePickerTouchStart}
      style={styles.container}>
      <View
        pointerEvents="none"
        style={[
          styles.selectionHighlight,
          { backgroundColor: highlightColor, borderColor: accentColor },
        ]}
      />
      <WheelColumn
        accessibilityLabel="소비 시간 시 선택"
        columnId="hour"
        formatValue={(hour) => String(hour).padStart(2, '0')}
        items={HOURS}
        onChange={(hour) => updateValue({ hour })}
        onInteractionStart={handleInteractionStart}
        selectedValue={value.hour}
        width={74}
        cyclic
      />
      <Text style={styles.colon}>:</Text>
      <WheelColumn
        accessibilityLabel="소비 시간 분 선택"
        columnId="minute"
        formatValue={(minute) => String(minute).padStart(2, '0')}
        items={MINUTES}
        onChange={(minute) => updateValue({ minute })}
        onInteractionStart={handleInteractionStart}
        selectedValue={value.minute}
        width={74}
        cyclic
      />
      <WheelColumn
        accessibilityLabel="소비 시간 오전 오후 선택"
        columnId="period"
        formatValue={(period) => (period === 'AM' ? '오전' : '오후')}
        items={PERIODS}
        onChange={(period) => updateValue({ period })}
        onInteractionStart={handleInteractionStart}
        selectedValue={value.period}
        width={82}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    height: WHEEL_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
  },
  selectionHighlight: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
    borderRadius: 12,
    borderWidth: 1,
    height: ITEM_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: ITEM_HEIGHT,
  },
  column: {
    height: WHEEL_HEIGHT,
    overflow: 'hidden',
  },
  columnContent: {
    paddingVertical: ITEM_HEIGHT,
  },
  item: {
    alignItems: 'center',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
  },
  itemText: {
    color: '#A0A69D',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  itemTextSelected: {
    color: '#20231D',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  colon: {
    color: '#343832',
    fontSize: 22,
    fontWeight: '800',
    width: 16,
  },
});
