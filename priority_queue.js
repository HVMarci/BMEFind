const __top = 0;
const __parent = i => ((i + 1) >>> 1) - 1;
const __left = i => (i << 1) + 1;
const __right = i => (i + 1) << 1;

class PriorityQueue {
  constructor(comparator = (a, b) => a > b) {
    this._heap = [];
    this._comparator = comparator;
  }
  size() {
    return this._heap.length;
  }
  isEmpty() {
    return this.size() == 0;
  }
  peek() {
    return this._heap[__top];
  }
  push(...values) {
    values.forEach(value => {
      this._heap.push(value);
      this._siftUp();
    });
    return this.size();
  }
  pop() {
    const poppedValue = this.peek();
    const bottom = this.size() - 1;
    if (bottom > __top) {
      this._swap(__top, bottom);
    }
    this._heap.pop();
    this._siftDown();
    return poppedValue;
  }
  replace(value) {
    const replacedValue = this.peek();
    this._heap[__top] = value;
    this._siftDown();
    return replacedValue;
  }
  _greater(i, j) {
    return this._comparator(this._heap[i], this._heap[j]);
  }
  _swap(i, j) {
    [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
  }
  _siftUp() {
    let node = this.size() - 1;
    while (node > __top && this._greater(node, __parent(node))) {
      this._swap(node, __parent(node));
      node = __parent(node);
    }
  }
  _siftDown() {
    let node = __top;
    while (
      (__left(node) < this.size() && this._greater(__left(node), node)) ||
      (__right(node) < this.size() && this._greater(__right(node), node))
    ) {
      let maxChild = (__right(node) < this.size() && this._greater(__right(node), __left(node))) ? __right(node) : __left(node);
      this._swap(node, maxChild);
      node = maxChild;
    }
  }
}
