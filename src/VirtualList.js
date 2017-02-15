import React, { PureComponent, PropTypes } from 'react';
import ReactDOM from 'react-dom';

import getVisibleItemBounds from './utils/getVisibleItemBounds';

const defaultMapToVirtualProps = ({
  items,
  itemHeight,
}, {
  firstItemIndex,
  lastItemIndex,
}) => {
  const visibleItems = lastItemIndex > -1 ? items.slice(firstItemIndex, lastItemIndex + 1) : [];
  // would be nice to make this not break shallowCompare with items.slice
  // but theoretically we're only rendering if we need to

  // style
  const height = items.length * itemHeight;
  const paddingTop = firstItemIndex * itemHeight;

  return {
    virtual: {
      items: visibleItems,
      style: {
        height,
        paddingTop,
      },
    }
  };
}

const VirtualList = (options, mapVirtualToProps = defaultMapToVirtualProps) => (InnerComponent) => {
  return class vlist extends PureComponent {
    static propTypes = {
      items: PropTypes.array.isRequired,
      itemHeight: PropTypes.number.isRequired,
      itemBuffer: PropTypes.number,
    };

    static defaultProps = {
      itemBuffer: 0,
    };

    constructor(props) {
      super(props);

      this.options = {
        container: typeof window !== 'undefined' ? window : undefined,
        ...options,
      };

      this.state = {
        firstItemIndex: 0,
        lastItemIndex: -1,
      };

      // initialState allows us to set the first/lastItemIndex (useful for server-rendering)
      if (options && options.initialState) {
        this.state = {
          ...this.state,
          ...options.initialState,
        };
      }

      this.refreshState = this.refreshState.bind(this);

      // if requestAnimationFrame is available, use it to throttle refreshState
      if (window && 'requestAnimationFrame' in window) {
        const refreshState = this.refreshState;

        this.refreshState = () => {
          if (this.isRefreshingState) return;

          this.isRefreshingState = true;

          window.requestAnimationFrame(() => {
            refreshState();

            this.isRefreshingState = false;
          });
        };
      }
    };

    setStateIfNeeded(list, container, items, itemHeight, itemBuffer) {
      // get first and lastItemIndex
      const state = getVisibleItemBounds(list, container, items, itemHeight, itemBuffer);

      if (state !== undefined && (state.firstItemIndex !== this.state.firstItemIndex || state.lastItemIndex !== this.state.lastItemIndex)) {
        this.setState(state);
      }
    }

    refreshState() {
      const { itemHeight, items, itemBuffer } = this.props;

      this.setStateIfNeeded(this.domNode, this.options.container, items, itemHeight, itemBuffer);
    };

    componentDidMount() {
      // cache the DOM node
      this.domNode = ReactDOM.findDOMNode(this);

      // we need to refreshState because we didn't have access to the DOM node before
      this.refreshState();

      // add events
      this.options.container.addEventListener('scroll', this.refreshState);
      this.options.container.addEventListener('resize', this.refreshState);
    };

    componentWillUnmount() {
      // remove events
      this.options.container.removeEventListener('scroll', this.refreshState);
      this.options.container.removeEventListener('resize', this.refreshState);
    };

    // if props change, just assume we have to recalculate
    componentWillReceiveProps(nextProps) {
      const { itemHeight, items, itemBuffer } = nextProps;

      this.setStateIfNeeded(this.domNode, this.options.container, items, itemHeight, itemBuffer);
    };

    render() {
      return (<InnerComponent {...this.props} {...mapVirtualToProps(this.props, this.state)} />);
    };
  };
};

export default VirtualList;
