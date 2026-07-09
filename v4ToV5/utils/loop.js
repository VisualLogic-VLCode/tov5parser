import { genXid } from '../env.js'
import { genForEachConObj } from './con.js'
import { convertEditorValue } from './formula.js'

// 生成画布下（随机）对象循环的循环块ref
function genLoopRef({ range }) {
  return range
    ? {
        op: 'entries',
        args: [
          {
            op: 'var',
            args: [
              {
                op: 'get',
                args: [
                  {
                    op: 'ref',
                    val: ['var', range]
                  },
                  {
                    op: 'method',
                    val: '_getChildren'
                  }
                ],
                _blockType: '$refs'
              }
            ]
          }
        ]
      }
    : {
        op: 'entries',
        args: [
          {
            op: 'val'
          }
        ]
      }
}

function genLoopCon({ loopId, range }) {
  return {
    op: 'let',
    val: [loopId, 'JsonVal'],
    args: [genLoopRef({ range })]
  }
}

function genCandidateIndexesAdd({ loopId }) {
  return {
    ln: genXid(),
    op: 'set',
    args: [
      {
        op: 'ref',
        val: ['local', 'candidateIndexes']
      },
      {
        op: 'var',
        args: [
          {
            op: 'get',
            args: [
              {
                op: 'ref',
                val: ['local', 'candidateIndexes']
              },
              {
                op: 'sysutil',
                val: 'arr_push',
                _blockType: 'sysutil',
                args: [
                  {
                    op: 'var',
                    args: [
                      {
                        op: 'get',
                        args: [
                          {
                            op: 'ref',
                            val: ['local', loopId]
                          },
                          {
                            op: 'index',
                            args: [
                              {
                                op: 'val',
                                val: 0
                              }
                            ],
                            _uiSkip: true
                          }
                        ],
                        _cbParamsType: 'forEachParamsIndex',
                        _blockType: '$cbParams'
                      }
                    ]
                  }
                ]
              }
            ],
            _cbParamsType: 'localVar',
            _blockType: '$cbParams'
          }
        ]
      }
    ],
    _paramsFold: true
  }
}

function genShuffleCon({ addShuffleCon, loopId, children }) {
  if (addShuffleCon) {
    return [
      {
        op: 'switch',
        args: [
          {
            op: 'sysop',
            args: [
              {
                op: 'var',
                args: [
                  {
                    op: 'get',
                    args: [
                      {
                        op: 'ref',
                        val: ['local', loopId]
                      },
                      {
                        op: 'index',
                        args: [
                          {
                            op: 'val',
                            val: 0
                          }
                        ],
                        _uiSkip: true
                      }
                    ],
                    _cbParamsType: 'forEachParamsIndex',
                    _blockType: '$cbParams'
                  }
                ]
              },
              {
                op: 'var',
                args: [
                  {
                    op: 'get',
                    args: [
                      {
                        op: 'ref',
                        val: ['local', 'candidateIndexes']
                      }
                    ],
                    _cbParamsType: 'localVar',
                    _blockType: '$cbParams'
                  }
                ]
              }
            ],
            val: 'arrayBelongTo'
          },
          {
            op: 'block',
            args: children,
            ln: genXid()
          }
        ],
        ln: genXid()
      }
    ]
  }
  return children
}

function genLoopBody({
  children,
  loopId,
  additionType,
  additionCons,
  scope,
  nodeId,
  addShuffleCon = false
}) {
  let loopBody = {
    op: 'block'
  }

  if (additionType) {
    // 添加循环对象类型判断条件块
    let switchAst = {
      op: 'switch',
      args: [
        {
          op: '=',
          args: [
            {
              op: 'var',
              args: [
                {
                  op: 'get',
                  args: [
                    {
                      op: 'ref',
                      val: ['local', loopId]
                    },
                    {
                      op: 'index',
                      args: [
                        {
                          op: 'val',
                          val: 1
                        }
                      ],
                      _uiSkip: true
                    },
                    {
                      op: 'field',
                      val: '_ivxType'
                    }
                  ],
                  _blockType: '$cbParams',
                  _cbParamsType: 'forEachParamsIndex'
                }
              ]
            },
            {
              op: 'var',
              args: [
                {
                  op: 'get',
                  args: [
                    {
                      op: 'ref',
                      val: ['var', additionType]
                    },
                    {
                      op: 'field',
                      val: '_ivxType'
                    }
                  ],
                  _blockType: '$refs'
                }
              ]
            }
          ]
        },
        { op: 'block', ln: genXid() }
      ],
      ln: genXid()
    }
    // 添加额外条件块
    if (additionCons?.length > 0) {
      let cons = additionCons.map(conItem => {
        return genForEachConObj({
          conItem,
          scope,
          loopVar: loopId,
          nodeId
        })
      })
      let extraSwitchAst = {
        op: 'switch',
        args: [{ op: 'block', ln: genXid() }],
        ln: genXid()
      }
      if (cons.length > 1) {
        extraSwitchAst.args.unshift({ op: 'and', args: cons })
      } else {
        extraSwitchAst.args.unshift(cons[0])
      }
      if (children.length > 0) {
        extraSwitchAst.args[1].args = genShuffleCon({
          addShuffleCon,
          loopId,
          children
        })
      }
      switchAst.args[1].args = [extraSwitchAst]
    } else {
      if (children.length > 0) {
        switchAst.args[1].args = genShuffleCon({
          addShuffleCon,
          loopId,
          children
        })
      }
    }
    loopBody.args = [switchAst]
  } else {
    if (children.length > 0) {
      loopBody.args = genShuffleCon({
        addShuffleCon,
        loopId,
        children
      })
    }
  }

  return loopBody
}

// 画布下随机对象循环生额外shuffle部分
function genShuffleAst({ block, scope, nodeId, shuffleMax }) {
  let shuffle = {
    op: 'block',
    args: []
  }
  // 局部变量candidateIndexes赋值空数组
  shuffle.args.push({
    ln: genXid(),
    op: 'set',
    args: [
      {
        op: 'ref',
        val: ['local', 'candidateIndexes']
      },
      {
        op: 'var',
        args: [
          {
            op: 'list',
            args: []
          }
        ]
      }
    ],
    _paramsFold: true
  })
  // 数组循环画布的所有子对象，筛选出符合条件的子对象数组
  let loopId = genXid()
  let children = [genCandidateIndexesAdd({ loopId })]
  shuffle.args.push({
    ln: loopId,
    args: [
      genLoopCon({ loopId, range: block.addition?.range }),
      genLoopBody({
        children,
        loopId,
        additionType: block.addition?.type,
        additionCons: block.addition?.cons,
        scope,
        nodeId
      })
    ],
    op: 'for'
  })
  // 局部变量randomArr赋值空数组
  shuffle.args.push({
    ln: genXid(),
    op: 'set',
    args: [
      {
        op: 'ref',
        val: ['local', 'randomArr']
      },
      {
        op: 'var',
        args: [
          {
            op: 'list',
            args: []
          }
        ]
      }
    ]
  })
  // 生成randomArr
  shuffle.args.push({
    op: 'while',
    args: [
      {
        op: '<',
        args: [
          {
            op: 'var',
            args: [
              {
                op: 'get',
                args: [
                  {
                    op: 'ref',
                    val: ['local', 'randomArr']
                  },
                  {
                    op: 'sysutil',
                    val: 'arr_itemTotal',
                    _blockType: 'sysutil'
                  }
                ],
                _cbParamsType: 'localVar',
                _blockType: '$cbParams'
              }
            ]
          },
          {
            op: 'var',
            args: [
              {
                op: 'get',
                _blockType: '$sysUtil',
                args: [
                  {
                    op: 'ref',
                    val: ['js', 'Math']
                  },
                  {
                    op: 'method',
                    val: 'min',
                    args: [
                      convertEditorValue({
                        value: shuffleMax,
                        nodeId,
                        blockId: block.bid
                      }),
                      {
                        op: 'var',
                        args: [
                          {
                            op: 'get',
                            args: [
                              {
                                op: 'ref',
                                val: ['local', 'candidateIndexes']
                              },
                              {
                                op: 'sysutil',
                                val: 'arr_itemTotal',
                                _blockType: 'sysutil'
                              }
                            ],
                            _cbParamsType: 'localVar',
                            _blockType: '$cbParams'
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        op: 'block',
        args: [
          {
            ln: genXid(),
            op: 'set',
            args: [
              {
                op: 'ref',
                val: ['local', 'randomNum']
              },
              {
                op: 'var',
                args: [
                  {
                    op: 'get',
                    _blockType: '$sysUtil',
                    args: [
                      {
                        op: 'ref',
                        val: ['js', 'Math']
                      },
                      {
                        op: 'method',
                        val: 'floor',
                        args: [
                          {
                            op: 'var',
                            args: [
                              {
                                op: '*',
                                args: [
                                  {
                                    op: 'get',
                                    _blockType: '$sysUtil',
                                    args: [
                                      {
                                        op: 'ref',
                                        val: ['js', 'Math']
                                      },
                                      {
                                        op: 'method',
                                        val: 'random'
                                      }
                                    ]
                                  },
                                  {
                                    op: 'get',
                                    args: [
                                      {
                                        op: 'ref',
                                        val: ['local', 'candidateIndexes']
                                      },
                                      {
                                        op: 'sysutil',
                                        val: 'arr_itemTotal',
                                        _blockType: 'sysutil'
                                      }
                                    ],
                                    _cbParamsType: 'localVar',
                                    _blockType: '$cbParams'
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            op: 'switch',
            args: [
              {
                op: 'sysop',
                args: [
                  {
                    op: 'var',
                    args: [
                      {
                        op: 'get',
                        args: [
                          {
                            op: 'ref',
                            val: ['local', 'randomArr']
                          }
                        ],
                        _cbParamsType: 'localVar',
                        _blockType: '$cbParams'
                      }
                    ]
                  },
                  {
                    op: 'var',
                    args: [
                      {
                        op: 'get',
                        args: [
                          {
                            op: 'ref',
                            val: ['local', 'randomNum']
                          }
                        ],
                        _cbParamsType: 'localVar',
                        _blockType: '$cbParams'
                      }
                    ]
                  }
                ],
                val: 'arrayNotInclude'
              },
              {
                op: 'block',
                args: [
                  {
                    ln: genXid(),
                    op: 'set',
                    args: [
                      {
                        op: 'ref',
                        val: ['local', 'randomArr']
                      },
                      {
                        op: 'var',
                        args: [
                          {
                            op: 'get',
                            args: [
                              {
                                op: 'ref',
                                val: ['local', 'randomArr']
                              },
                              {
                                op: 'sysutil',
                                val: 'arr_push',
                                _blockType: 'sysutil',
                                args: [
                                  {
                                    op: 'var',
                                    args: [
                                      {
                                        op: 'get',
                                        args: [
                                          {
                                            op: 'ref',
                                            val: ['local', 'randomNum']
                                          }
                                        ],
                                        _cbParamsType: 'localVar',
                                        _blockType: '$cbParams'
                                      }
                                    ]
                                  }
                                ]
                              }
                            ],
                            _cbParamsType: 'localVar',
                            _blockType: '$cbParams'
                          }
                        ]
                      }
                    ],
                    _paramsFold: true
                  }
                ],
                ln: genXid()
              }
            ],
            ln: genXid()
          }
        ]
      }
    ],
    ln: genXid()
  })
  // 生成candidateIndexes
  shuffle.args.push({
    ln: genXid(),
    op: 'set',
    args: [
      {
        op: 'ref',
        val: ['local', 'candidateIndexes']
      },
      {
        op: 'var',
        args: [
          {
            op: 'get',
            args: [
              {
                op: 'ref',
                val: ['local', 'randomArr']
              },
              {
                op: 'sysutil',
                val: 'arr_map',
                _blockType: 'sysutil',
                args: [
                  {
                    op: 'lambda',
                    val: ['item', 'index'],
                    args: [
                      {
                        op: 'block',
                        args: [
                          {
                            op: 'return',
                            args: [
                              {
                                op: 'var',
                                args: [
                                  {
                                    op: 'get',
                                    args: [
                                      {
                                        op: 'ref',
                                        val: ['local', 'candidateIndexes']
                                      },
                                      {
                                        op: 'sysutil',
                                        val: 'arr_oneArrItem',
                                        _blockType: 'sysutil',
                                        args: [
                                          {
                                            op: 'var',
                                            args: [
                                              {
                                                op: 'get',
                                                args: [
                                                  {
                                                    op: 'ref',
                                                    val: ['local', 'item']
                                                  }
                                                ],
                                                _blockType: '$cbParams'
                                              }
                                            ]
                                          }
                                        ]
                                      }
                                    ],
                                    _cbParamsType: 'localVar',
                                    _blockType: '$cbParams'
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ],
                    _blockType: 'funcInParam'
                  }
                ]
              }
            ],
            _cbParamsType: 'localVar',
            _blockType: '$cbParams'
          }
        ]
      }
    ],
    _paramsFold: true
  })

  return shuffle
}

export { genLoopCon, genLoopBody, genShuffleAst }
