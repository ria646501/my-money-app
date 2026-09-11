import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  items: readonly T[];
  selectedValue: T;
  formatValue: (value: T) => string;
  onChange: (value: T) => void;
  width: number;
  cyclic?: boolean;
};

const WheelItem = memo(
  forwardRef<Text, { isSelected: boolean; text: string }>(function WheelItem(
    { isSelected, text },
    ref
  ) {
    return (
      <View style={styles.item}>
        <Text ref={ref} style={isSelected ? styles.itemTextSelected : styles.itemText}>
          {text}
        </Text>
      </View>
    );
  })
);

function WheelColumn<T extends string | number>({
  accessibilityLabel,
  items,
  selectedValue,
  formatValue,
  onChange,
  width,
  cyclic = false,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitializedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isMomentumScrollingRef = useRef(false);
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

    if (nextValue !== selectedValue) {
      lastCommittedValueRef.current = nextValue;
      onChange(nextValue);
    }
  };

  const handleDragBegin = () => {
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
    finalizeSelection(event.nativeEvent.contentOffset.y);
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
        onScroll={handleScroll}
        onScrollBeginDrag={handleDragBegin}
        onScrollEndDrag={handleDragEnd}
        ref={scrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={ITEM_HEIGHT}>
        {displayItems.map((item, index) => {
          const isSelected = index === middleSelectedIndex;

          return (
            <WheelItem
              isSelected={isSelected}
              key={`${String(item)}-${index}`}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              text={formatValue(item)}
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
};

export function TimeWheelPicker({ value, onChange }: TimeWheelPickerProps) {
  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.selectionHighlight} />
      <WheelColumn
        accessibilityLabel="소비 시간 시 선택"
        formatValue={(hour) => String(hour).padStart(2, '0')}
        items={HOURS}
        onChange={(hour) => onChange({ ...value, hour })}
        selectedValue={value.hour}
        width={74}
        cyclic
      />
      <Text style={styles.colon}>:</Text>
      <WheelColumn
        accessibilityLabel="소비 시간 분 선택"
        formatValue={(minute) => String(minute).padStart(2, '0')}
        items={MINUTES}
        onChange={(minute) => onChange({ ...value, minute })}
        selectedValue={value.minute}
        width={74}
        cyclic
      />
      <WheelColumn
        accessibilityLabel="소비 시간 오전 오후 선택"
        formatValue={(period) => (period === 'AM' ? '오전' : '오후')}
        items={PERIODS}
        onChange={(period) => onChange({ ...value, period })}
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
