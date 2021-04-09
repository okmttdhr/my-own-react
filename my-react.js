let currentRoot = null
let deletions = null
let nextUnitOfWork = null
let workInProgressFiber = null
let workInProgressRoot = null

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberFlags.js#L19-L22
const PLACEMENT = 'PLACEMENT'
const UPDATE = 'UPDATE'
const DELETION = 'DELETION'

// https://github.com/facebook/react/blob/master/packages/react/src/ReactElement.js#L349
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === 'object'
          ? child
          : createTextElement(child)
      ),
    },
  }
}
function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberBeginWork.new.js#L255
function reconcileChildren(workInProgressFiber, elements) {
  let index = 0
  let oldFiber =
    workInProgressFiber.alternate && workInProgressFiber.alternate.child
  let prevSibling = null

  while (
    index < elements.length ||
    oldFiber != null
  ) {
    const element = elements[index]
    let newFiber = null

    const sameType =
      oldFiber &&
      element &&
      element.type == oldFiber.type

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: workInProgressFiber,
        alternate: oldFiber,
        flag: UPDATE,
      }
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: workInProgressFiber,
        alternate: null,
        flag: PLACEMENT,
      }
    }
    if (oldFiber && !sameType) {
      oldFiber.flag = DELETION
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      workInProgressFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

const isEvent = key => key.startsWith('on')
const isProperty = key =>
  key !== 'children' && !isEvent(key)
const isNew = (prev, next) => key =>
  prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)

// https://github.com/okmttdhr/react/blob/master/packages/react-dom/src/client/ReactDOMHostConfig.js#L445
function commitUpdate(dom, prevProps, nextProps) {
  // Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(
      key =>
        !(key in nextProps) ||
        isNew(prevProps, nextProps)(key)
    )
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.removeEventListener(
        eventType,
        prevProps[name]
      )
    })

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ''
    })

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.addEventListener(
        eventType,
        nextProps[name]
      )
    })
}

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberBeginWork.new.js#L1230
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    const dom =
      fiber.type == 'TEXT_ELEMENT'
        ? document.createTextNode('')
        : document.createElement(fiber.type)
    fiber.dom = dom
    commitUpdate(fiber.dom, {}, fiber.props)
  }
  reconcileChildren(fiber, fiber.props.children)
}

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberBeginWork.new.js#L865
function updateFunctionComponent(fiber) {
  workInProgressFiber = fiber
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

// https://github.com/okmttdhr/react/blob/master/packages/react-reconciler/src/ReactFiberBeginWork.new.js#L3206
function beginWork(fiber) {
  const isFunctionComponent =
    fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  if (fiber.child) {
    return fiber.child
  }

  // TODO: uncle
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

// https://github.com/okmttdhr/react/blob/master/packages/react-reconciler/src/ReactFiberCommitWork.new.js#L1558
function commitPlacement(fiber, parentDom) {
  parentDom.appendChild(fiber.dom)
}

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberCommitWork.new.js#L1795
function commitDeletion(fiber, parentDom) {
  if (fiber.dom) {
    parentDom.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, parentDom)
  }
}

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberCommitWork.new.js#L1814
function commitWork(fiber) {
  if (!fiber) {
    return
  }

  let parentFiber = fiber.parent
  while (!parentFiber.dom) {
    parentFiber = parentFiber.parent
  }
  const parentDom = parentFiber.dom

  if (
    fiber.flag === PLACEMENT &&
    fiber.dom != null
  ) {
    commitPlacement(fiber, parentDom)
  } else if (
    fiber.flag === UPDATE &&
    fiber.dom != null
  ) {
    commitUpdate(
      fiber.dom,
      fiber.alternate.props,
      fiber.props
    )
  } else if (fiber.flag === DELETION) {
    commitDeletion(fiber, parentDom)
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L1693
function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(workInProgressRoot.child)
  currentRoot = workInProgressRoot
  workInProgressRoot = null
}

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L1574
function performUnitOfWork(fiber) {
  nextUnitOfWork = beginWork(fiber)
  if (!nextUnitOfWork) {
    commitRoot()
  }
}

// https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1567
function workLoop(deadline) {
  let shouldYield = false
  // while (nextUnitOfWork && !shouldYield) {
  while (workInProgressRoot && !shouldYield) {
    performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }
  requestIdleCallback(workLoop)
}

// https://github.com/facebook/react/blob/master/packages/react-dom/src/client/ReactDOMLegacy.js#L287
function render(element, container) {
  workInProgressRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  }
  deletions = []
  nextUnitOfWork = workInProgressRoot

  requestIdleCallback(workLoop)
}

const MyReact = {
  createElement,
  render,
}

const text = 'mine'

const a = createElement('a', {}, text)
const p = createElement('p', {}, text)

const h2 = createElement('h2', {}, text)
const h1 = createElement('h1', {}, p, a)

const child3 = createElement('div', {}, h1, h2)
const child2 = createElement('div', {}, h1, h2)

const child = createElement('div', {}, child2, child3)

const element = createElement('div', null, child)

const container = document.getElementById('root')
MyReact.render(element, container)
